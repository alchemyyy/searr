import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FilterPresetValues = Record<string, string>;

@Entity()
class FilterPreset {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ unique: true })
  public name: string;

  @Column({ type: 'simple-json' })
  public filters: FilterPresetValues;

  @Column({ default: false })
  public isDefaultMovie: boolean;

  @Column({ default: false })
  public isDefaultTv: boolean;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<FilterPreset>) {
    Object.assign(this, init);
  }
}

export default FilterPreset;
