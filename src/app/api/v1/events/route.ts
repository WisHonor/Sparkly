import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { FREE_QUOTA, PRO_QUOTA } from "@/config";

import { CATEGORY_NAME_VALIDATOR } from "@/lib/validators/category-validator";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";

const EVENT_CATEGORY_VALIDATOR = z.object({
  name: CATEGORY_NAME_VALIDATOR,
  color: z
    .string()
    .min(1, "Color is required")
    .regex(/^#[0-9A-F]{6}$/i, "Invalid color format."),
  emoji: z.string().emoji("Invalid emoji").optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser(); // or however you get the current user

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Count existing categories
    const categoriesCount = await db.eventCategory.count({
      where: { userId: user.id },
    });

    // Get user's plan
    const plan = await db.user.findUnique({
      where: { id: user.id },
      select: { plan: true },
    });

    const isProExceeded =
      plan?.plan === "PRO" &&
      categoriesCount >= PRO_QUOTA.maxEventCategories;

    const isFreeExceeded =
      plan?.plan === "FREE" &&
      categoriesCount >= FREE_QUOTA.maxEventCategories;

    if (isFreeExceeded) {
      return new NextResponse(
        JSON.stringify({
          message: "Categories limit reached. Please upgrade to PRO plan.",
        }),
        { status: 400 }
      );
    }

    if (isProExceeded) {
      return new NextResponse(
        JSON.stringify({
          message: "Please remove categories to create a new one.",
        }),
        { status: 400 }
      );
    }

    // Parse and validate request
    const body = await req.json();
    const validated = EVENT_CATEGORY_VALIDATOR.parse(body);

    // Create new event category
    await db.eventCategory.create({
      data: {
        name: validated.name,
        color: parseInt(validated.color.replace("#", ""), 16),
        emoji: validated.emoji,
        userId: user.id,
      },
    });

    return new NextResponse(
      JSON.stringify({ message: "Category created successfully" }),
      { status: 201 }
    );
  } catch (err) {
    console.error(err);

    if (err instanceof z.ZodError) {
      return new NextResponse(
        JSON.stringify({ message: err.message }),
        { status: 422 }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Internal server error" }),
      { status: 500 }
    );
  }
}
