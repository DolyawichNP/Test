# Interactive 3D Airflow Room Simulator

HTML app สำหรับจำลองแนวโน้มการเคลื่อนตัวของอากาศในห้องแบบ 3D และคำนวณอุณหภูมิห้องโดยประมาณ

## สถานะ CFD / Engineering

App นี้เป็น **CFD-inspired preliminary airflow simulator** สำหรับดูแนวโน้มการไหลของอากาศและอุณหภูมิเท่านั้น

ยัง **ไม่ใช่ CFD ที่รับรองงานวิศวกรรม** เพราะการรับรองจริงต้องมีอย่างน้อย:

- validated CFD solver
- mesh generation และ mesh independence test
- boundary condition ที่กำหนดและตรวจสอบได้
- turbulence / heat transfer model ที่เหมาะกับงาน
- calibration กับผลวัดจริงหรือ benchmark
- verification & validation report
- วิศวกรผู้เชี่ยวชาญตรวจรับผล

## ค่าเริ่มต้น baseline แบบไทย

ค่าเริ่มต้นตั้งไว้เป็น baseline ห้องใช้งานทั่วไปในไทย ไม่ใช่มาตรฐานบังคับ:

- ห้อง: 4.00 x 4.00 x 2.60 m
- Air: 12,000 BTU, CFM 420, target 25°C
- ขนาดตัว Air model: 0.90 x 0.30 x 0.22 m
- ประตู: 0.80 x 2.00 m
- หน้าต่าง: 1.20 x 1.10 m
- อุณหภูมิเริ่มต้น: 31°C
- อุณหภูมิภายนอก: 34°C
- Heat load ตั้งต้น: 550 W

## ใช้ทำอะไรได้

- กำหนดขนาดห้อง กว้าง / ยาว / สูง
- วางตำแหน่ง Air, Fan, Door, Window ในพิกัด X/Y/Z
- แสดง Air / Door / Window เป็น model สี่เหลี่ยมใกล้ของจริงมากขึ้น
- ลาก Object ในมุมมอง 3D เพื่อย้ายตำแหน่ง
- ลากจุดในแปลนห้องแบบ top-down เพื่อจัด layout ง่ายขึ้น
- เปิด-ปิดอุปกรณ์แต่ละตัว
- ปรับ BTU, CFM, target temperature, supply air temperature
- ปรับขนาดประตู/หน้าต่างและเปอร์เซ็นต์การเปิด
- กรอกตัวแปรสิ่งแวดล้อม เช่น อุณหภูมิภายนอก, heat load, wind speed, leakage ACH
- ใช้ preset ห้องประชุม / ห้องทำงาน / ห้องนอน
- Save layout ลง browser
- Download / Load layout เป็น JSON
- Export รายงาน simulation เป็น PDF
- ดู particle airflow และอุณหภูมิห้องแบบ realtime

## โครงสร้างไฟล์

```text
index.html   # โครง HTML และหน้าจอหลัก
style.css    # CSS ทั้งหมด
script.js    # logic, 3D rendering, simulation, drag/drop, save/load, preset, PDF export
```

## วิธีเปิดใช้งาน

เปิดไฟล์ `index.html` ใน browser ได้เลย

> หมายเหตุ: ไฟล์ใช้ Three.js และ jsPDF ผ่าน CDN ดังนั้นตอนเปิดควรมี Internet

## วิธีเปิดผ่าน GitHub Pages

1. เข้า repo นี้ใน GitHub
2. ไปที่ `Settings`
3. เข้าเมนู `Pages`
4. Source เลือก `Deploy from a branch`
5. Branch เลือก `main` และ folder เลือก `/root`
6. กด `Save`
7. รอสักครู่ GitHub จะสร้าง URL สำหรับเปิดเว็บ

## สูตรโดยย่อ

อุณหภูมิรวมของห้องใช้ lumped thermal model:

```text
dT/dt = (Q_heat + rho * Cp * Vdot_vent * (T_out - T_room) - Q_AC)
        / (rho * Volume * Cp * ThermalMass)
```

ทิศทางลมใช้ vector field แบบ CFD-inspired heuristic จาก jet ของแอร์, jet ของพัดลม, ลมจากช่องเปิด และแรงลอยตัวเล็กน้อย ไม่ใช่ Navier-Stokes solver เต็มรูปแบบ
