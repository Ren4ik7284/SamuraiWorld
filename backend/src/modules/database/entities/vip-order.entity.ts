import { Entity, Column, PrimaryColumn } from 'typeorm';

export type OrderType = 'vip' | 'pass';
export type OrderStatus = 'PENDING' | 'DELIVERED' | 'FAILED';

@Entity('vip_orders')
export class VipOrderEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  orderId: string;

  @Column({ type: 'varchar', length: 16 })
  nickname: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 8, default: 'vip' })
  type: OrderType;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: OrderStatus;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'jsonb', nullable: true })
  deliveryResult: any;
}
