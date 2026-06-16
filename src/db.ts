// src/db.ts
// Singleton PrismaClient instance shared across the application.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
