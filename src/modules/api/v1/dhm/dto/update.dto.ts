import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateDto {
  @IsNumber()
  @IsNotEmpty()
  kline1Ts: number;

  @IsNumber()
  @IsNotEmpty()
  kline2Ts: number;

  @IsString()
  @IsNotEmpty()
  status: 'created' | 'waiting' | 'triggered';

  @IsBoolean()
  @IsNotEmpty()
  confirmed: boolean;
}
