const fs = require('fs');
const schemaPath = '/home/sagar/Desktop/ForensIQ/forensiq-backend/config/database/schema.prisma';

let schema = fs.readFileSync(schemaPath, 'utf8');

if (!schema.includes('couponUses            CouponUse[]')) {
  schema = schema.replace(
    '  updatedCoupons            Coupon[] @relation("CouponUpdatedBy")',
    '  updatedCoupons            Coupon[] @relation("CouponUpdatedBy")\n  couponUses                CouponUse[]'
  );
  fs.writeFileSync(schemaPath, schema);
}
console.log('Schema fixed successfully');
