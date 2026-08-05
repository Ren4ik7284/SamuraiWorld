import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { RulesComponent } from './pages/rules/rules.component';
import { WorldComponent } from './pages/world/world.component';
import { ContactsComponent } from './pages/contacts/contacts.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'rules', component: RulesComponent },
  { path: 'world', component: WorldComponent },
  { path: 'contacts', component: ContactsComponent },
  { path: '**', redirectTo: '' }
];
