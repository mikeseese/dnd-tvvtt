import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { NextResponse } from "next/server";
import { getMimeType } from "~/lib/utils";

const UPLOAD_DIR = join(process.cwd(), "data", "uploads");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const filePath = join(UPLOAD_DIR, ...path);

    // Prevent directory traversal
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await stat(filePath);
    const buffer = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = getMimeType(ext);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
