import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateDto {
  @IsNumber()
  @IsNotEmpty()
  kline1Ts: number;

  @IsString()
  @IsNotEmpty()
  status: 'created' | 'waiting' | 'triggered';

  @IsBoolean()
  @IsNotEmpty()
  confirmed: boolean;

  @IsNumber()
  @IsOptional()
  low: number;

  @IsNumber()
  @IsOptional()
  high: number;
}
