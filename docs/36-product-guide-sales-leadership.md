# PeopleOS — Simple Product Guide

**For:** Leadership, sales, and anyone new to the product  
**As of:** 14 November 2026

---

## 1. What is PeopleOS?

PeopleOS is the company’s HR and workplace app.

Employees use it for everyday needs: leave, attendance, payslips, documents, helpdesk, and company laptops or other assets.

Managers, HR, and IT use the **same app**, with extra screens for approvals and administration.

**Think of it as:** one login for your work life at the company — instead of chasing emails and spreadsheets.

**It is not (for now):** a full payroll calculator, performance reviews, training courses, or expenses. Payslips are uploaded by HR as PDF files for people to download.

---

## 2. The big idea

1. Everyone signs in once and lands on **Home**.
2. The left menu shows **Me** for everyone.
3. Extra menu sections appear based on the person’s job (Manager, HR, IT, Leadership, and so on).
4. Work stays in one place — no separate “portals” to switch between.

---

## 3. What people can do in the app

### For every employee (Me)

- Apply for leave and see balances  
- See attendance and punch in/out (when allowed)  
- Download documents and payslip PDFs  
- See and request company assets (laptop, phone, etc.)  
- Raise a helpdesk ticket  
- Change password and theme  

### For managers

- Approve or reject leave for their team  
- Approve or reject attendance corrections  
- See team leave and attendance  

### For HR

- Maintain employee records and the org structure  
- Manage leave balances and attendance rules  
- Upload documents and payslips  
- See work queues (what is waiting)  

### For IT (and HR Head)

- Keep the asset register (what the company owns)  
- Issue, return, and transfer assets  
- Handle fault and loss reports  
- Run maintenance and asset reports  

### For Security / Admin

- Decide who gets which role in the system  
- Approve leave at company level when needed  

### For Leadership

- See live numbers: headcount, people on leave, exceptions, waiting approvals  

---

## 4. How work flows (simple stories)

### Leave

Employee applies → Manager approves or rejects → Balance updates → Employee gets a notification.

### Attendance

Person punches on the web or a biometric clock → If something looks wrong, they ask for a correction → Manager decides → HR can lock the month when ready for payroll.

### Laptop / asset

Employee requests kit → Manager (and others if needed) approve → IT issues the asset → Employee acknowledges → Later they can return it or report damage/loss.

### Access

Admin assigns a role (for example Manager) → Next login shows the new menu → That person can start approving or administering.

---

## 5. Who sees what (roles)

| Role | Extra menu they get | In plain words |
|------|---------------------|----------------|
| Employee | Me only | Self-service |
| Manager | Approvals + team time | Decide for their team |
| HR Executive | People, leave/attendance admin, documents | Run day-to-day HR |
| HR Head | Same as HR + Assets | HR plus asset oversight |
| IT Admin | Assets + admin tools | Own company equipment |
| Security Admin | Users & Roles, admin | Control access |
| Leadership | Leadership reports | See the pulse |
| Finance (read) | No special Finance menu yet | Can read own payslips if given the role |

---

## 6. What is ready vs still coming

**Ready to show today**

- Sign-in and forgot password  
- Leave apply and approve  
- Attendance (web + biometric clocks)  
- HR employee and org records  
- Documents and payslip PDFs  
- My Assets and full IT asset tracking  
- Helpdesk tickets (employee side)  
- Leadership live numbers  
- Mobile attendance  

**Still thin or unfinished**

- Some Home and Manager overview numbers  
- HR helpdesk “desk” screen (backend is ready)  
- Admin audit / jobs / settings screens  
- Email alerts for approvals (in-app works; email mostly for password reset)  
- Mobile beyond attendance  

**Not planned soon**

- Full payroll engine inside PeopleOS  
- Performance / OKR, LMS, expenses  
- WhatsApp or AI agents  

---

## 7. Try it locally (demo)

Open the web app, then sign in with any of these (password for all: `ChangeMe123!`):

| Email | Best to show |
|-------|----------------|
| `employee@peopleos.local` | Leave, attendance, assets, helpdesk |
| `manager@peopleos.local` | Approvals inbox |
| `hr@peopleos.local` | Employees, leave/attendance admin, documents |
| `it@peopleos.local` | Asset register and tickets |
| `admin@peopleos.local` | Users & Roles |

Web: http://localhost:5173/login  
Details: [Credentials.md](../Credentials.md)

**Suggested 20-minute walkthrough**

1. Employee — apply leave, open attendance, open My Assets.  
2. Manager — approve that leave in Inbox.  
3. HR — show employees and upload/view a document.  
4. IT — show asset register.  
5. Admin — assign Leadership role; show Leadership numbers.

---

## 8. Where to go deeper

| If you need… | Open… |
|--------------|--------|
| Programme / approval story | [31-management-overview](31-management-overview.md) |
| Exact Live vs Planned list | [34-feature-catalog](34-feature-catalog.md) |
| Step-by-step as built | [33-implemented-workflow-catalog](33-implemented-workflow-catalog.md) |

---

*This guide is for understanding and demos. It is not a commercial contract and does not invent ROI numbers.*
