import { PipeTransform, ArgumentMetadata, BadRequestException, Injectable } from '@nestjs/common';
import * as zod from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: zod.ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      throw new BadRequestException('Validation failed');
    }
  }
}
