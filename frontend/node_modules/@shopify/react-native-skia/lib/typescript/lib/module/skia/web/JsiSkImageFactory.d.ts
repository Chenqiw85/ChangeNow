export class JsiSkImageFactory extends Host {
    MakeNull(): JsiSkImage;
    MakeImageFromViewTag(viewTag: any): Promise<null>;
    MakeImageFromNativeBuffer(buffer: any, surface: any, image: any): JsiSkImage;
    MakeImageFromEncoded(encoded: any): JsiSkImage | null;
    MakeImageFromNativeTextureUnstable(): jest.Mock<any, any, any>;
    MakeImage(info: any, data: any, bytesPerRow: any): JsiSkImage | null;
    MakeImageFromTexture(_texture: any): jest.Mock<any, any, any>;
    MakeTextureFromImage(_image: any): jest.Mock<any, any, any>;
}
import { Host } from "./Host";
import { JsiSkImage } from "./JsiSkImage";
