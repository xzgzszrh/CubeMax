import {
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

export class CreateSimulatorSessionDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;
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
