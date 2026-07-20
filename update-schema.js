const fs = require('fs');
const schemaPath = '/home/sagar/Desktop/ForensIQ/forensiq-backend/config/database/schema.prisma';

let schema = fs.readFileSync(schemaPath, 'utf8');

if (!schema.includes('model Coupon')) {
  const newModels = `
model Coupon {
  id                    String        @id @default(uuid())
  code                  String        @unique
  title                 String
  description           String?
  discountType          DiscountType  @default(PERCENTAGE)
  discountValue         Int
  maxDiscountAmount     Int?
  minimumPurchaseAmount Int?
  applicableTo          CouponScope   @default(ALL_COURSES)
  stackable             Boolean       @default(false)
  firstPurchaseOnly     Boolean       @default(false)
  validFrom             DateTime?
  validUntil            DateTime?
  usageLimit            Int?
  usedCount             Int           @default(0)
  perUserLimit          Int           @default(1)
  isActive              Boolean       @default(true)
  createdById           String?
  updatedById           String?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  createdBy             User?         @relation("CouponCreatedBy", fields: [createdById], references: [id])
  updatedBy             User?         @relation("CouponUpdatedBy", fields: [updatedById], references: [id])
  courses               Course[]      @relation("CourseToCoupon")
  couponUses            CouponUse[]
  payments              Payment[]
}

enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
  FREE_COURSE
  FLAT_PRICE
}

enum CouponScope {
  ALL_COURSES
  SELECTED_COURSES
}

model CouponUse {
  id        String   @id @default(uuid())
  couponId  String
  userId    String
  paymentId String?
  createdAt DateTime @default(now())

  coupon    Coupon   @relation(fields: [couponId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  payment   Payment? @relation(fields: [paymentId], references: [id])

  @@index([couponId])
  @@index([userId])
}
`;
  schema += newModels;
}

// Add User relations for Coupon createdBy/updatedBy
if (!schema.includes('createdCoupons')) {
  schema = schema.replace(
    '  payments                  Payment[]',
    '  payments                  Payment[]\n  createdCoupons            Coupon[] @relation("CouponCreatedBy")\n  updatedCoupons            Coupon[] @relation("CouponUpdatedBy")'
  );
}

// Add Course relation for Coupons
if (!schema.includes('coupons       Coupon[]')) {
  schema = schema.replace(
    '  enrollments Enrollment[]',
    '  enrollments Enrollment[]\n  coupons       Coupon[]  @relation("CourseToCoupon")'
  );
}

// Add Payment fields for Coupons
if (!schema.includes('couponId          String?')) {
  schema = schema.replace(
    '  enrollments       Enrollment[]',
    '  enrollments       Enrollment[]\n  couponId          String?\n  originalAmount    Int?\n  discountAmount    Int?\n  coupon            Coupon?       @relation(fields: [couponId], references: [id])\n  couponUses        CouponUse[]'
  );
}

fs.writeFileSync(schemaPath, schema);
console.log('Schema updated successfully');
