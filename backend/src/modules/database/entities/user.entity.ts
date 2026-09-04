import { Entity, Column, PrimaryColumn } from 'typeorm';

export type UserRole = 'user' | 'support' | 'admin';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 16, unique: true })
  nickname: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'text' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 16, default: 'user' })
  role: UserRole;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'boolean', default: false })
  isVip: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  vipGrantedAt: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLogin: Date | null;
}
