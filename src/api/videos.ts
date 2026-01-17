import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { randomBytes, type UUID } from "crypto";
import path from "path";
import { Buffer } from "buffer";


export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: UUID };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("No thumbnail file provided");
  }
  if (
    file.type.split("/")[1].includes("jpeg") ||
    file.type.split("/")[1].includes("png")
  ) {
  } else {
    throw new BadRequestError(
      `Invalid thumbnail file type. Only JPEG and PNG are allowed. ${
        file.type.split("/")[1]
      }`
    );
  }
  if (file.size > 1 << 30) {
    // 10MB limit
    throw new BadRequestError("Thumbnail file size exceeds 10MB limit");
  }
  const mediaType = file.type;
  const imageData = Buffer.from(await file.arrayBuffer());
  const metadata = getVideo(cfg.db, videoId);
  if (metadata?.userID !== userID) {
    throw new UserForbiddenError(
      "You do not have permission to upload a thumbnail for this video"
    );
  }

  const ext = mediaType.split("/")[1];
  const filename = `${randomBytes(32).toString("base64url")}.${ext}`;

  // 1. Save to disk under cfg.assetsRoot
  const pathURL = path.join(cfg.assetsRoot, filename);
  await Bun.write(pathURL, imageData);

  // 2. Expose via URL under /assets
  const thumbnailURL = `http://localhost:${cfg.port}/assets/${filename}`;
  metadata.thumbnailURL = thumbnailURL;
  updateVideo(cfg.db, metadata);
  return respondWithJSON(200, { metadata });
}
