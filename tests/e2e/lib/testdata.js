// The owner's test data (cost / sale / opening stock / barcode).
module.exports.PRODUCTS = [
  { name: 'Dollar Pointer Pen Blue', barcode: '1001', stock: 200, retail: 30, cost: 20, packs: [{ preset: 'Box', contains: 10, retail: 280, cost: 200 }] },
  { name: 'Piano Ball Pen', barcode: '1003', stock: 100, retail: 20, cost: 15 },
  { name: 'Dux Pencil', barcode: '1004', stock: 120, retail: 20, cost: 11, packs: [{ preset: 'Box', contains: 12, retail: 200, cost: 132 }] },
  { name: 'Oxford Notebook', barcode: '1006', stock: 50, retail: 180, cost: 140 },
  { name: 'Single Line Register Small', barcode: '1007', stock: 30, retail: 110, cost: 80 },
  { name: 'Single Line Register Large', barcode: '1008', stock: 20, retail: 200, cost: 150 },
  { name: 'A4 Paper Rim', barcode: '1009', stock: 20, retail: 1350, cost: 1150 },
  { name: 'Deer Geometry Box', barcode: '1010', stock: 15, retail: 350, cost: 260 },
  { name: 'UHU Glue Stick', barcode: '1011', stock: 40, retail: 100, cost: 70 },
  { name: 'Casio fx-991 Calculator', barcode: '1012', stock: 5, retail: 3800, cost: 3200 },
  { name: 'Urdu Textbook Class 5', barcode: '1013', stock: 25, retail: 380, cost: 300 },
];
module.exports.CUSTOMERS = [
  { name: 'Ahmed Raza', phone: '0300-1234567' },
  { name: 'Bilal Hussain', phone: '0321-7654321', owed: 2000 },
  { name: 'Sana Bibi', phone: '0333-1112223', advance: 500 },
];
module.exports.SUPPLIERS = [
  { name: 'Lahore Stationers', owed: 5000 },
  { name: 'Gujranwala Book Depot' },
];
