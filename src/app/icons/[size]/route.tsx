import { ImageResponse } from "next/og";
import { AppIcon } from "@/components/AppIcon";

export async function GET(_: Request, ctx: RouteContext<"/icons/[size]">) {
  const size = (await ctx.params).size === "512" ? 512 : 192;
  return new ImageResponse(<AppIcon size={size} />, { width: size, height: size });
}
