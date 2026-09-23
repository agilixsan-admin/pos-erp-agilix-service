import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { ChartOfAccount } from './chart-of-account.entity';

@Entity('journal_entry_lines')
@Index(['journalEntryId'])
@Index(['accountId'])
export class JournalEntryLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  debit!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  credit!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry!: JournalEntry;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'account_id' })
  account!: ChartOfAccount;
}
