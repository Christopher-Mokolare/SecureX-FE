import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { StartTransaction } from './pages/start-transaction/start-transaction';
import { TransactionBuyer } from './pages/transaction-buyer/transaction-buyer';
import { TransactionSeller } from './pages/transaction-seller/transaction-seller';
import { PaymentReturn } from './pages/payment-return/payment-return';
import { BankDetails } from './pages/bank-details/bank-details';
import { Terms } from './pages/terms/terms';
import { Faq } from './pages/faq/faq';
import { Admin } from './pages/admin/admin';
import { NotFound } from './pages/not-found/not-found';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'start', component: StartTransaction },
  { path: 'transaction/:id/buyer', component: TransactionBuyer },
  { path: 'transaction/:id/seller', component: TransactionSeller },
  { path: 'payment-return', component: PaymentReturn },
  { path: 'bank-details/:id', component: BankDetails },
  { path: 'terms', component: Terms },
  { path: 'faq', component: Faq },
  { path: 'admin', component: Admin },
  { path: '**', component: NotFound },
];
