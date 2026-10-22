import type {
  BackendSelectionMatchType,
  BackendSelectionRuleType,
  MetadataTagReference,
} from '@server/constants/backendSelection';
import type { MediaType } from '@server/constants/media';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export {
  BackendSelectionMatchType,
  BackendSelectionRuleType,
  MetadataTagProvider,
  MetadataTagType,
} from '@server/constants/backendSelection';
export type { MetadataTagReference } from '@server/constants/backendSelection';

@Entity()
@Index(['mediaType', 'position'])
class BackendSelectionRule {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public mediaType: MediaType;

  @Column({ type: 'int' })
  public serviceId: number;

  @Column()
  public ruleType: BackendSelectionRuleType;

  @Column()
  public matchType: BackendSelectionMatchType;

  @Column({ type: 'simple-json' })
  public tags: MetadataTagReference[];

  @Column({ type: 'int' })
  public position: number;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<BackendSelectionRule>) {
    Object.assign(this, init);
  }
}

export default BackendSelectionRule;
