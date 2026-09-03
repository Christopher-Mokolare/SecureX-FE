import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { StartTransaction } from './pages/start-transaction/start-transaction';
import { Terms } from './pages/terms/terms';
import { NotFound } from './pages/not-found/not-found';
import { BankDetails } from './pages/bank-details/bank-details';
import { PaymentReturn } from './pages/payment-return/payment-return';
import { TransactionSeller } from './pages/transaction-seller/transaction-seller';
import { TransactionBuyer } from './pages/transaction-buyer/transaction-buyer';
import { Admin } from './pages/admin/admin';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'start', component: StartTransaction },
  { path: 'payment-return', component: PaymentReturn },
  { path: 'bank-details/:sellerId', component: BankDetails },
  { path: 'transaction/:txId/seller', component: TransactionSeller },
  { path: 'transaction/:txId/buyer', component: TransactionBuyer },
  { path: 'terms', component: Terms },
  { path: 'admin', component: Admin },
  { path: '**', component: NotFound },
];
