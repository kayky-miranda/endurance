import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// H.264 com qualidade alta pro Product Hunt.
Config.setCodec("h264");
Config.setCrf(18);
