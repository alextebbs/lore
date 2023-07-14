import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "~/utils/db";
import { verifyHasAccess } from "~/utils/verify";

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return new Response(null, { status: 400 }); // Bad Request

    if (!(await verifyHasAccess(id))) {
      return new Response(null, { status: 403 }); // Forbidden
    }

    await db.character.delete({
      where: { id },
    });

    revalidatePath("/");

    // return new Response(null, { status: 204 }); // No Content
    return NextResponse.json(
      { revalidated: true, now: Date.now() },
      { status: 204 }
    );
  } catch (err) {
    return new Response(null, { status: 500 }); // Internal Server Error
  }
}
