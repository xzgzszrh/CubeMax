import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from "class-validator";

import type { SimulatorBoardType, SimulatorOperation } from "./simulator.types";
import { SIMULATOR_BOARD_TYPES } from "./simulator.types";

export class CreateSimulatorSessionDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsIn(SIMULATOR_BOARD_TYPES)
    boardType?: SimulatorBoardType;
}

export class UpdateSimulatorBoardDto {
    @IsIn(SIMULATOR_BOARD_TYPES)
    boardType: SimulatorBoardType;
}

export class UpdateSimulatorInputDto {
    @IsIn(["button", "potentiometer"])
    type: "button" | "potentiometer";

    @IsOptional()
    @IsBoolean()
    pressed?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(4095)
    value?: number;
}

export class WriteSimulatorSerialDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    text: string;
}

export class ApplySimulatorOperationsDto {
    @IsArray()
    @ArrayMaxSize(200)
    operations: SimulatorOperation[];
}
