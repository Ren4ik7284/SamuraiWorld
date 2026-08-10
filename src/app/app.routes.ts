import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { RulesComponent } from './pages/rules/rules.component';
import { WorldComponent } from './pages/world/world.component';
import { ContactsComponent } from './pages/contacts/contacts.component';
import { SupportComponent } from './pages/support/support.component';
import { StoreComponent } from './pages/store/store.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'store', component: StoreComponent },
  { path: 'donate', redirectTo: 'store', pathMatch: 'full' },
  { path: 'rules', component: RulesComponent },
  { path: 'world', component: WorldComponent },
  { path: 'contacts', component: ContactsComponent },
  { path: 'support', component: SupportComponent },
  { path: '**', redirectTo: '' }
];

