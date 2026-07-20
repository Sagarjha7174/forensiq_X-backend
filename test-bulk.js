const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
  
  if (!admin) {
    console.log("No SUPERADMIN found");
    return;
  }

  // Update admin password temporarily to a known value for testing
  const hashedPassword = await bcrypt.hash("password123", 10);
  await prisma.user.update({
    where: { id: admin.id },
    data: { password: hashedPassword }
  });

  const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '1h' });
  
  // Test verify-password API
  const testPassword = (password) => new Promise((resolve) => {
    const data = JSON.stringify({ password });
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/admin/verify-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.write(data);
    req.end();
  });

  console.log("Testing wrong password...");
  const wrongRes = await testPassword("wrongpass");
  console.log(`Expected 401, got ${wrongRes.status}:`, wrongRes.body);

  console.log("Testing correct password...");
  const rightRes = await testPassword("password123");
  console.log(`Expected 200, got ${rightRes.status}:`, rightRes.body);

}

main().finally(() => prisma.$disconnect());
