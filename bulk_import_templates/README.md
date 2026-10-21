# Bulk Import Excel Templates

This directory contains pre-configured demonstration and standard template files formatted specifically for the bulk import modules in **Quaders School Management System**.

---

## 📁 Available Templates

### 1. `Bulk_Import_Students_Template.xlsx`
* **Target Module**: Admin Portal -> Student Management (`/admin/students`) -> **Bulk Import**
* **Sheet Name**: `Students`
* **Mandatory Columns**:
  * `Full Name` (or `Name`, `Student Name`)
  * `Admission Number` (Unique ID per school)
* **Recommended & Supported Columns**:
  * `Class` (e.g. `Grade 10`) - Auto-links or creates class
  * `Section` (e.g. `A`)
  * `Date of Birth` (YYYY-MM-DD)
  * `Age`
  * `Gender` (`Male`, `Female`, `Other`)
  * `Blood Group` (e.g. `O+`, `A+`, `B+`)
  * `Nationality`, `Religion`, `Mother Tongue`, `Aadhar Number`
  * `Home Address`
  * `Parent/Guardian Name`, `Parent Phone`, `Parent Email`, `Parent Occupation`
  * `Emergency Contact`
  * `Annual Income (INR)`, `Sibling Name`, `Previous School`, `Previous Records`
  * `Subjects Chosen`, `Bus Route`
  * `Tuition Fee (INR)`, `Hostel Fee (INR)`, `Book Fee (INR)`, `Other Fee (INR)`, `Total Fee (INR)`
  * `Username`, `Password`

---

### 2. `Bulk_Import_Staff_Template.xlsx`
* **Target Module**: Admin Portal -> Staff Assignment (`/admin/staff`) -> **Bulk Import**
* **Sheet Name**: `Staff Import`
* **Mandatory Columns**:
  * `Full Name`
  * `Email Address`
* **Supported Columns (32 Columns Total)**:
  * `Staff ID`, `Date of Birth`, `Gender`, `Nationality`, `Marital Status`, `Blood Group`, `Aadhar Number`, `Languages Known`, `Mobile Number`, `Residential Address`, `Emergency Contact Details`, `Father Name/Guardian Name`, `Highest Qualification`, `Degree(s) and Specialization`, `University/College Name`, `Year of Passing`, `Previous Experience (Years)`, `Previous School/Organization`, `Subject Specialization`, `Grades/Classes Handled`, `Certifications`, `Government-issued ID`, `Tax Identification Details (PAN)`, `PF Number`, `ESIC Number`, `UAN Number`, `Bank Account Number`, `Bank Name and Branch`, `IFSC Code`, `PAN Number`.

---

### 3. `Bulk_Import_Classes_Template.xlsx`
* **Target Module**: Admin Portal -> Class & Section Management (`/admin/classes`) -> **Bulk Import**
* **Sheet Name**: `Classes Template`
* **Columns**:
  * `Class Name` (*Mandatory*, e.g., "Grade 10")
  * `Section` (*Mandatory*, e.g., "A", "B")
  * `Category` (*Optional*, e.g., "High School", "Middle School", "Primary School" - automatically created if not existing)

---

### 4. `Bulk_Import_Inventory_Template.xlsx`
* **Target Module**: Admin Portal -> Inventory Management (`/admin/inventory`) -> **Bulk Import**
* **Sheet Name**: `Template`
* **Columns**:
  * `ID Number` (Optional SKU / Item Code)
  * `Product Name` (*Mandatory*)
  * `Category` (*Mandatory*, e.g., Stationery, Sports, Medical)
  * `Initial Stock` (Numeric stock count)

---

### 5. `Bulk_Import_Homework_Grades_Template.xlsx`
* **Target Module**: Teacher Portal -> Homework Management (`/teacher/homework`) -> **Bulk Grade Import**
* **Sheet Name**: `Grades`
* **Columns**:
  * `Admission Number`
  * `Homework Title`
  * `Status` (`Completed`, `Submitted`, `Pending`)
  * `Grade` (e.g., `A+`, `A`, `B`, etc.)

---

## 💡 Tips for Successful Imports
1. Do not rename column headers.
2. For student imports, ensure admission numbers are unique across your school tenant.
3. Class and Section names in student imports will automatically map to existing classes or create new ones if they do not yet exist.
