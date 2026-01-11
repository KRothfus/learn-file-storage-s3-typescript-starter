import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { Buffer } from "buffer";
import path from "path";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here
  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("No thumbnail file provided");
  }
  if (
    file.type.split("/")[1].includes("jpeg") ||
    file.type.split("/")[1].includes("png")
  ) {}
  else {
    throw new BadRequestError(
      `Invalid thumbnail file type. Only JPEG and PNG are allowed. ${
        file.type.split("/")[1]
      }`
    );
  }
  if (file.size > 10 << 20) {
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

  const fileh = `/assets/${videoId}.${file.type.split("/")[1]}`;
  const pathURL = path.join(cfg.assetsRoot, fileh);
  await Bun.write(pathURL, imageData);
  // const dataURL = `data:image/png;base64,${imageData}`;
  const thumbnailURL = `http://localhost:${cfg.port}` + fileh;
  metadata.thumbnailURL = thumbnailURL;
  updateVideo(cfg.db, metadata);
  return respondWithJSON(200, { metadata });
}
