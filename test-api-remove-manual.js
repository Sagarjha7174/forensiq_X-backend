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

  // 1. Create a dummy user
  const user = await prisma.user.create({
    data: {
      email: `test-api-remove-${Date.now()}@example.com`,
      name: "Test Remove",
      password: "password",
      phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      degree: "BTech",
      classes: "CS",
    }
  });

  // 2. Create a dummy course
  const course = await prisma.course.create({
    data: {
      name: "Test Course",
      description: "Desc",
      price: 100,
      status: "ACTIVE"
    }
  });

  // 3. Assign course
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      courseId: course.id,
      razorpayOrderId: `test-order-${Date.now()}`,
      status: "SUCCESS",
      amount: course.price
    }
  });

  const enrollment = await prisma.enrollment.create({
    data: {
      userId: user.id,
      courseId: course.id,
      paymentId: payment.id,
      source: "ADMIN",
      status: "ACTIVE",
    }
  });

  console.log("Created enrollment:", enrollment.id);

  // 4. Remove via API
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: `/api/v1/enrollments/${enrollment.id}`,
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, async res => {
    console.log(`statusCode: ${res.statusCode}`);
    let data = '';
    res.on('data', d => {
      data += d;
    });
    res.on('end', async () => {
      console.log("Response:", data);
      
      // Check if payment was deleted
      const checkPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      console.log("Payment exists?", !!checkPayment);

      // cleanup
      await prisma.course.delete({ where: { id: course.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    });
  });

  req.on('error', error => {
    console.error(error);
  });

  req.end();
}

main();
