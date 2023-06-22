import { db, verifyCurrentUserHasAccessToItem } from "~/utils/db";

export async function DELETE(request: Request) {
  try {
    console.time("delete");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return new Response(null, { status: 400 }); // Bad Request

    if (!(await verifyCurrentUserHasAccessToItem(id))) {
      return new Response(null, { status: 403 }); // Forbidden
    }

    await db.character.delete({
      where: { id },
    });
    console.timeEnd("delete");

    return new Response(null, { status: 204 }); // No Content
  } catch (err) {
    return new Response(null, { status: 500 }); // Internal Server Error
  }
}
