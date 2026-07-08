# Interactive 3D Airflow Room Simulator

HTML app สำหรับจำลองแนวโน้มการเคลื่อนตัวของอากาศในห้องแบบ 3D และคำนวณอุณหภูมิห้องโดยประมาณ

## ใช้ทำอะไรได้

- กำหนดขนาดห้อง กว้าง / ยาว / สูง
- วางตำแหน่ง Air, Fan, Door, Window ในพิกัด X/Y/Z
- เปิด-ปิดอุปกรณ์แต่ละตัว
- ปรับ BTU, CFM, target temperature, supply air temperature
- ปรับขนาดประตู/หน้าต่างและเปอร์เซ็นต์การเปิด
- กรอกตัวแปรสิ่งแวดล้อม เช่น อุณหภูมิภายนอก, heat load, wind speed, leakage ACH
- ดู particle airflow และอุณหภูมิห้องแบบ realtime

## วิธีเปิดใช้งาน

เปิดไฟล์ `index.html` ใน browser ได้เลย

> หมายเหตุ: ไฟล์ใช้ Three.js ผ่าน CDN ดังนั้นตอนเปิดควรมี Internet

## วิธีเปิดผ่าน GitHub Pages

1. เข้า repo นี้ใน GitHub
2. ไปที่ `Settings`
3. เข้าเมนู `Pages`
4. Source เลือก `Deploy from a branch`
5. Branch เลือก `main` และ folder เลือก `/root`
6. กด `Save`
7. รอสักครู่ GitHub จะสร้าง URL สำหรับเปิดเว็บ

## ข้อจำกัดสำคัญ

Simulation นี้เป็นโมเดลเชิงประมาณการ / conceptual model ไม่ใช่ CFD ระดับวิศวกรรมจริง จึงใช้ดูแนวโน้มเพื่อประกอบการพูดคุยตำแหน่งติดตั้ง ไม่ควรใช้แทนการคำนวณรับรองงานออกแบบจริง

## สูตรโดยย่อ

อุณหภูมิรวมของห้องใช้ lumped thermal model:

```text
dT/dt = (Q_heat + rho * Cp * Vdot_vent * (T_out - T_room) - Q_AC)
        / (rho * Volume * Cp * ThermalMass)
```

ทิศทางลมใช้ vector field แบบ heuristic จาก jet ของแอร์, jet ของพัดลม, ลมจากช่องเปิด และแรงลอยตัวเล็กน้อย
