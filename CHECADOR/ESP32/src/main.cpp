#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <time.h>
#include <Preferences.h>

const char* WIFI_SSID="TU_WIFI";
const char* WIFI_PASSWORD="TU_PASSWORD";
const char* SYNC_URL="https://pibvfosvufbwbnwfwbmw.supabase.co/functions/v1/checador-sync";
const char* DEVICE_CODE="PEGAR_CODIGO_GENERADO_EN_RH";
const char* DEVICE_TOKEN="PEGAR_TOKEN_GENERADO_EN_RH";
const size_t SYNC_BATCH_MAX=100;
HardwareSerial FingerSerial(2);
Adafruit_Fingerprint finger(&FingerSerial);
Preferences prefs;

struct MapRow{uint16_t fingerId;const char* employee;};
MapRow mappings[]={{1,"EMP-001"}};
const size_t mappingCount=sizeof(mappings)/sizeof(mappings[0]);

String uuidLike(){uint64_t a=esp_random(),b=esp_random(),c=esp_random(),d=esp_random();char s[80];snprintf(s,sizeof(s),"%08lx-%04lx-%04lx-%04lx-%08lx%04lx",(unsigned long)a,(unsigned long)(b&0xffff),(unsigned long)((b>>16)&0xffff),(unsigned long)(c&0xffff),(unsigned long)d,(unsigned long)((c>>16)&0xffff));return String(s);}
String isoNow(){struct tm t;if(!getLocalTime(&t))return "";char b[40];strftime(b,sizeof(b),"%Y-%m-%dT%H:%M:%S-06:00",&t);return String(b);}
uint32_t employeeHash(const String& value){uint32_t h=2166136261u;for(size_t i=0;i<value.length();i++){h^=(uint8_t)value[i];h*=16777619u;}return h;}
String employeeForFinger(uint16_t id){String saved=prefs.getString(("f"+String(id)).c_str(),"");if(saved.length())return saved;for(size_t i=0;i<mappingCount;i++)if(mappings[i].fingerId==id)return String(mappings[i].employee);return "";}
String stateKey(const String& employee){char key[12];snprintf(key,sizeof(key),"e%08lx",(unsigned long)employeeHash(employee));return String(key);}
String lastType(const String& employee){return prefs.getString(stateKey(employee).c_str(),"");}
String autoType(const String& employee){return lastType(employee)=="entrada"?"salida":"entrada";}

bool waitForFinger(bool present,unsigned long timeoutMs=15000){unsigned long start=millis();while(millis()-start<timeoutMs){uint8_t r=finger.getImage();if(present&&r==FINGERPRINT_OK)return true;if(!present&&r==FINGERPRINT_NOFINGER)return true;delay(120);}return false;}
bool enrollFinger(uint16_t id,const String& employee){Serial.println("Coloca el dedo...");if(!waitForFinger(true))return false;if(finger.image2Tz(1)!=FINGERPRINT_OK)return false;Serial.println("Retira el dedo...");if(!waitForFinger(false))return false;delay(500);Serial.println("Coloca el mismo dedo otra vez...");if(!waitForFinger(true))return false;if(finger.image2Tz(2)!=FINGERPRINT_OK)return false;if(finger.createModel()!=FINGERPRINT_OK)return false;if(finger.storeModel(id)!=FINGERPRINT_OK)return false;prefs.putString(("f"+String(id)).c_str(),employee);Serial.printf("Huella %u asociada a %s\n",id,employee.c_str());waitForFinger(false);return true;}
void processSerial(){if(!Serial.available())return;String line=Serial.readStringUntil('\n');line.trim();if(!line.length())return;int p1=line.indexOf(' ');String cmd=(p1<0?line:line.substring(0,p1));cmd.toUpperCase();String rest=p1<0?"":line.substring(p1+1);rest.trim();int p2=rest.indexOf(' ');if(cmd=="ENROLL"&&p2>0){uint16_t id=(uint16_t)rest.substring(0,p2).toInt();String employee=rest.substring(p2+1);employee.trim();if(id&&employee.length())Serial.println(enrollFinger(id,employee)?"OK":"ERROR");return;}if(cmd=="MAP"&&p2>0){uint16_t id=(uint16_t)rest.substring(0,p2).toInt();String employee=rest.substring(p2+1);employee.trim();if(id&&employee.length()){prefs.putString(("f"+String(id)).c_str(),employee);Serial.println("OK");}return;}if(cmd=="UNMAP"){uint16_t id=(uint16_t)rest.toInt();if(id){prefs.remove(("f"+String(id)).c_str());finger.deleteModel(id);Serial.println("OK");}return;}Serial.println("Comandos: ENROLL <id> <empleado> | MAP <id> <empleado> | UNMAP <id>");}

size_t pendingCount(){File f=LittleFS.open("/queue.ndjson","r");if(!f)return 0;size_t count=0;while(f.available()){String line=f.readStringUntil('\n');line.trim();if(line.length())count++;}f.close();return count;}

void appendEvent(const String& employee,const String& type,const String& ref,float confidence){
  String stamp=isoNow();if(!stamp.length())return;
  StaticJsonDocument<512>d;d["event_uuid"]=uuidLike();d["employee_number"]=employee;d["type"]=type;d["timestamp"]=stamp;d["method"]="huella";d["biometric_ref"]=ref;d["confidence"]=confidence;
  File f=LittleFS.open("/queue.ndjson","a");if(!f)return;serializeJson(d,f);f.print('\n');f.close();prefs.putString(stateKey(employee).c_str(),type);
}

bool postPayload(DynamicJsonDocument& body,DynamicJsonDocument& out){
  HTTPClient http;http.begin(SYNC_URL);http.addHeader("Content-Type","application/json");http.addHeader("x-device-code",DEVICE_CODE);http.addHeader("x-device-token",DEVICE_TOKEN);
  String payload;serializeJson(body,payload);int code=http.POST(payload);String response=http.getString();http.end();
  if(code!=200&&code!=207)return false;
  if(deserializeJson(out,response))return false;
  return out["ok"]==true&&out["rejected"].as<int>()==0;
}

bool syncOneBatch(){
  if(WiFi.status()!=WL_CONNECTED)return false;
  File input=LittleFS.open("/queue.ndjson","r");
  if(!input)return true;
  LittleFS.remove("/queue.rest");File rest=LittleFS.open("/queue.rest","w");
  DynamicJsonDocument body(65536);body["batch_uuid"]=uuidLike();body["sync_type"]="incremental";body["finalize_week"]=false;body["firmware"]="75.0-esp32";body["source"]="esp32-local-first";JsonArray events=body.createNestedArray("events");
  size_t sent=0,total=0;
  while(input.available()){
    String line=input.readStringUntil('\n');line.trim();if(!line.length())continue;total++;
    if(sent<SYNC_BATCH_MAX){DynamicJsonDocument e(768);if(!deserializeJson(e,line)){events.add(e.as<JsonObject>());sent++;}else{rest.println(line);}}
    else rest.println(line);
  }
  input.close();rest.close();
  if(sent==0){LittleFS.remove("/queue.rest");return true;}
  body["pending_count"]=total;DynamicJsonDocument out(12288);
  if(!postPayload(body,out)){LittleFS.remove("/queue.rest");return false;}
  LittleFS.remove("/queue.ndjson");File check=LittleFS.open("/queue.rest","r");bool hasRest=check&&check.size()>0;if(check)check.close();if(hasRest)LittleFS.rename("/queue.rest","/queue.ndjson");else LittleFS.remove("/queue.rest");
  return true;
}

bool flushQueue(){size_t guard=0;while(pendingCount()>0&&guard<200){if(!syncOneBatch())return false;guard++;}return pendingCount()==0;}

bool finalizeWeek(const String& referenceDate){
  if(WiFi.status()!=WL_CONNECTED)return false;
  if(!flushQueue())return false;
  DynamicJsonDocument body(2048);body["batch_uuid"]=uuidLike();body["sync_type"]="cierre_semanal";body["finalize_week"]=true;body["reference_date"]=referenceDate;body["firmware"]="75.0-esp32";body["pending_count"]=0;body["source"]="esp32-local-first";body.createNestedArray("events");DynamicJsonDocument out(8192);return postPayload(body,out);
}

void connectWifi(){WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);unsigned long start=millis();while(WiFi.status()!=WL_CONNECTED&&millis()-start<15000)delay(250);if(WiFi.status()==WL_CONNECTED)configTime(-6*3600,0,"pool.ntp.org","time.google.com");}

void setup(){Serial.begin(115200);LittleFS.begin(true);prefs.begin("skilled",false);connectWifi();FingerSerial.begin(57600,SERIAL_8N1,16,17);finger.begin(57600);finger.verifyPassword();}

unsigned long lastSync=0;
String dateString(time_t value){struct tm t;localtime_r(&value,&t);char b[16];strftime(b,sizeof(b),"%Y-%m-%d",&t);return String(b);}
bool weeklyCloseDue(){
  time_t now=time(nullptr);if(now<100000)return false;
  struct tm current;localtime_r(&now,&current);int daysSinceMonday=(current.tm_wday+6)%7;
  struct tm monday=current;monday.tm_hour=0;monday.tm_min=0;monday.tm_sec=0;monday.tm_mday-=daysSinceMonday;time_t mondayTime=mktime(&monday);time_t due=mondayTime+2*24*3600+18*3600;
  if(now<due)mondayTime-=7*24*3600;
  struct tm endTm;localtime_r(&mondayTime,&endTm);char key[16];strftime(key,sizeof(key),"%Y-%j",&endTm);String last=prefs.getString("lastClose","");if(last==String(key))return false;
  String reference=dateString(mondayTime+2*24*3600);if(finalizeWeek(reference)){prefs.putString("lastClose",key);return true;}return false;
}

void loop(){
  processSerial();
  if(WiFi.status()!=WL_CONNECTED&&millis()%30000<250)connectWifi();
  if(finger.getImage()==FINGERPRINT_OK&&finger.image2Tz()==FINGERPRINT_OK&&finger.fingerFastSearch()==FINGERPRINT_OK){String employee=employeeForFinger(finger.fingerID);if(employee.length()){appendEvent(employee,autoType(employee),String(finger.fingerID),min(1.0f,(float)finger.confidence/250.0f));unsigned long releaseStart=millis();while(finger.getImage()!=FINGERPRINT_NOFINGER&&millis()-releaseStart<8000)delay(100);delay(350);}}
  if(millis()-lastSync>300000){syncOneBatch();weeklyCloseDue();lastSync=millis();}
  delay(120);
}
