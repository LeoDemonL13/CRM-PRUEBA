// Skilled CRM - carcasa conceptual para checador Raspberry Pi
// Modelo paramétrico inicial. Ajustar medidas al hardware final antes de imprimir.
$fn=48;
base_w=190; base_h=135; base_d=42; wall=3;
module rounded_box(w,h,d,r=8){minkowski(){cube([w-2*r,h-2*r,d-2*r],center=true);sphere(r);}}
module carcasa(){difference(){translate([0,0,base_d/2]) rounded_box(base_w,base_h,base_d,8); translate([0,0,base_d/2+wall]) rounded_box(base_w-2*wall,base_h-2*wall,base_d,6); translate([-48,8,base_d]) cube([78,48,20],center=true); translate([55,8,base_d]) cylinder(h=25,r=15,center=true); translate([70,-42,base_d]) cube([34,16,20],center=true); translate([-78,-46,base_d]) cylinder(h=25,r=3,center=true); translate([78,-46,base_d]) cylinder(h=25,r=3,center=true); translate([-78,46,base_d]) cylinder(h=25,r=3,center=true); translate([78,46,base_d]) cylinder(h=25,r=3,center=true);} }
module tapa(){translate([0,0,base_d+4]) difference(){rounded_box(base_w-8,base_h-8,5,6); translate([-48,8,0]) cube([72,42,10],center=true); translate([55,8,0]) cylinder(h=12,r=13,center=true); translate([70,-42,0]) cube([28,12,10],center=true);} }
carcasa();
//tapa();
