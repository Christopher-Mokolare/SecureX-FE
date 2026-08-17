import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { StartTransaction } from './pages/start-transaction/start-transaction';
import { Terms } from './pages/terms/terms';
import { NotFound } from './pages/not-found/not-found';
import { BankDetails } from './pages/bank-details/bank-details';
import { PaymentReturn } from './pages/payment-return/payment-return';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'start', component: StartTransaction },
  { path: 'payment-return', component: PaymentReturn },
  { path: 'bank-details/:sellerId', component: BankDetails },
  { path: 'terms', component: Terms },
  { path: '**', component: NotFound },
];
