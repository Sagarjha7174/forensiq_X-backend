const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
  
  if (!admin) {
    console.log("No SUPERADMIN found");
    return;
  }

  const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '1h' });
  console.log("Token:", token);

  // Get a random enrollment
  const enrollment = await prisma.enrollment.findFirst();
  if(!enrollment) return console.log("No enrollment");

  console.log("Deleting enrollment:", enrollment.id);

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: `/api/v1/enrollments/${enrollment.id}`,
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    let data = '';
    res.on('data', d => {
      data += d;
    });
    res.on('end', () => {
      console.log("Response:", data);
    });
  });

  req.on('error', error => {
    console.error(error);
  });

  req.end();
}

main().finally(() => prisma.$disconnect());
