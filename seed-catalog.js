const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categories = [
    {
      name: 'Digital Forensics Investigation',
      slug: 'digital-forensics',
      shortDescription: 'Comprehensive extraction and analysis of digital evidence.',
      isActive: true,
      displayOrder: 1,
      services: [
        {
          title: 'Computer Forensics',
          slug: 'computer-forensics',
          shortDescription: 'Deep dive into computer storage media.',
          estimatedMinPrice: 500,
          estimatedMaxPrice: 2000,
          isActive: true,
          allowDirectRequest: true,
          displayOrder: 1
        },
        {
          title: 'Mobile Device Forensics',
          slug: 'mobile-forensics',
          shortDescription: 'Extraction from smartphones and tablets.',
          estimatedMinPrice: 400,
          estimatedMaxPrice: 1500,
          isActive: true,
          allowDirectRequest: true,
          displayOrder: 2
        }
      ]
    },
    {
      name: 'Cyber Security Consulting',
      slug: 'cyber-security',
      shortDescription: 'Vulnerability assessments and strategic guidance.',
      isActive: true,
      displayOrder: 2,
      services: [
        {
          title: 'Penetration Testing',
          slug: 'pen-testing',
          shortDescription: 'Identify network vulnerabilities before attackers do.',
          estimatedMinPrice: 1000,
          estimatedMaxPrice: 5000,
          isActive: true,
          allowDirectRequest: true,
          displayOrder: 1
        }
      ]
    }
  ];

  for (const cat of categories) {
    const createdCat = await prisma.serviceCategory.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        shortDescription: cat.shortDescription,
        isActive: cat.isActive,
        displayOrder: cat.displayOrder,
      }
    });
    
    for (const srv of cat.services) {
      await prisma.serviceCatalogItem.create({
        data: {
          categoryId: createdCat.id,
          title: srv.title,
          slug: srv.slug,
          shortDescription: srv.shortDescription,
          estimatedMinPrice: srv.estimatedMinPrice,
          estimatedMaxPrice: srv.estimatedMaxPrice,
          isActive: srv.isActive,
          allowDirectRequest: srv.allowDirectRequest,
          displayOrder: srv.displayOrder
        }
      });
    }
  }
  console.log("Database seeded with sample categories and services!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
