const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const http = require("http");

async function main() {
  const user = await prisma.user.findFirst();
  console.log("Fetching user:", user.id);

  const req = http.request(`http://localhost:3001/api/v1/user/get/${user.id}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log("Response:", data));
  });
  req.end();
}
main().finally(() => prisma.$disconnect());
