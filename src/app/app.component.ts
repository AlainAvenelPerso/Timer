import { Component, OnDestroy, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Phase = 'ready' | 'work' | 'rest' | 'done';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  workSeconds = signal(45);
  restSeconds = signal(5);
  rounds = signal(4);
  phasesPerRound = signal(4);
  phase = signal<Phase>('ready');
  remaining = signal(45);
  currentRound = signal(1);
  currentPhase = signal(1);
  running = signal(false);
  soundEnabled = signal(true);
  startCountdown = signal<number | null>(null);
  private intervalId?: number;
  private lastAnnounced = -1;
  private phaseTotal = signal(45);

  phaseLabel = computed(() => ({ready:'PRÊT ?', work:'GAINE !', rest:'RÉCUPÈRE', done:'TERMINÉ !'}[this.phase()]));
  phaseHint = computed(() => this.phase()==='ready' ? 'Configure ta séance puis lance-toi' : this.phase()==='done' ? 'Belle séance, bravo !' : this.phasesPerRound()>1 ? `Série ${this.currentRound()}/${this.rounds()} · Phase ${this.currentPhase()}/${this.phasesPerRound()}` : `Série ${this.currentRound()} sur ${this.rounds()}`);
  progress = computed(() => {
    const total = this.phaseTotal();
    return this.phase()==='ready' ? 0 : Math.max(0, Math.min(100, ((total-this.remaining())/Math.max(total,1))*100));
  });

  updateWork(value: string) { const n=this.clamp(+value,5,600); this.workSeconds.set(n); if(this.phase()==='ready') this.remaining.set(n); }
  updateRest(value: string) { this.restSeconds.set(this.clamp(+value,0,300)); }
  updateRounds(value: string) { this.rounds.set(this.clamp(+value,1,20)); }
  updatePhases(value: string) { this.phasesPerRound.set(this.clamp(+value,1,20)); }
  adjust(target:'work'|'rest'|'rounds'|'phases', delta:number) {
    if(target==='work') this.updateWork(String(this.workSeconds()+delta));
    if(target==='rest') this.updateRest(String(this.restSeconds()+delta));
    if(target==='rounds') this.updateRounds(String(this.rounds()+delta));
    if(target==='phases') this.updatePhases(String(this.phasesPerRound()+delta));
  }

  async start() {
    this.stopTimer();
    if(this.phase()==='done') this.reset();
    if(this.restSeconds()>0) this.beginPhase('rest', this.restSeconds());
    else this.beginPhase('work');
  }

  togglePause() { this.running() ? this.stopTimer() : this.runTimer(); }
  reset() { this.stopTimer(); speechSynthesis?.cancel(); this.phase.set('ready'); this.currentRound.set(1); this.currentPhase.set(1); this.remaining.set(this.workSeconds()); this.phaseTotal.set(this.workSeconds()); this.startCountdown.set(null); }
  toggleSound() { this.soundEnabled.update(v=>!v); if(!this.soundEnabled()) speechSynthesis?.cancel(); }

  private beginPhase(phase:'work'|'rest', duration?:number) {
    const total = duration ?? (phase==='work' ? this.workSeconds() : this.restSeconds());
    this.phase.set(phase); this.phaseTotal.set(total); this.remaining.set(total); this.lastAnnounced=-1;
    this.speak(phase==='work' ? 'Gainage' : 'Pause'); this.runTimer();
  }
  private runTimer() {
    if(this.intervalId || this.phase()==='ready' || this.phase()==='done') return;
    this.running.set(true);
    this.intervalId=window.setInterval(()=>{
      const next=Math.max(0,this.remaining()-1); this.remaining.set(next);
      if(next>0 && next<=5 && next!==this.lastAnnounced){ this.lastAnnounced=next; this.speak(String(next)); }
      if(next===0) this.advance();
    },1000);
  }
  private stopTimer(){ if(this.intervalId) window.clearInterval(this.intervalId); this.intervalId=undefined; this.running.set(false); }
  private advance(){
    this.stopTimer();
    if(this.phase()==='rest') { this.beginPhase('work'); return; }
    const lastPhaseOfRound = this.currentPhase() >= this.phasesPerRound();
    const lastRound = this.currentRound() >= this.rounds();
    if(lastPhaseOfRound && lastRound){ this.phase.set('done'); this.speak('Séance terminée. Bravo !'); return; }
    if(lastPhaseOfRound){ this.currentRound.update(v=>v+1); this.currentPhase.set(1); }
    else { this.currentPhase.update(v=>v+1); }
    if(this.restSeconds()===0){ this.beginPhase('work'); } else this.beginPhase('rest');
  }
  private speak(text:string){ if(!this.soundEnabled() || !('speechSynthesis' in window)) return; speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='fr-FR'; u.rate=1.05; speechSynthesis.speak(u); }
  private delay(ms:number){ return new Promise<void>(resolve=>window.setTimeout(resolve,ms)); }
  private clamp(v:number,min:number,max:number){ return Math.min(max,Math.max(min,Number.isFinite(v)?v:min)); }
  ngOnDestroy(){ this.stopTimer(); speechSynthesis?.cancel(); }
}