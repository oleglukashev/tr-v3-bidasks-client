import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateDto {
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
  @IsNotEmpty()
  tf: number;

  @IsNumber()
  @IsNotEmpty()
  pairId: number;
}
