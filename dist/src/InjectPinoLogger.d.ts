import { Provider } from "@nestjs/common";
import { PinoLogger } from "./PinoLogger";
export declare function InjectPinoLogger(context?: string): (target: object, key: string | symbol, index?: number | undefined) => void;
export declare function createProvidersForDecorated(): Array<Provider<PinoLogger>>;
export declare function getLoggerToken(context: string): string;
