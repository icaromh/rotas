import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const modeRadios = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
  const speedLabel = document.getElementById('speed-label') as HTMLLabelElement;
  const speedInput = document.getElementById('speed-input') as HTMLInputElement;
  const sidebarToggle = document.getElementById('sidebar-toggle') as HTMLButtonElement;
  const sidebar = document.getElementById('sidebar') as HTMLElement;
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;

  // Toggle Sidebar on Mobile
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
  });

  // Handle Mode Change (Bike vs Walk)
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.value === 'bike') {
        speedLabel.textContent = 'Velocidade (km/h)';
        speedInput.value = '20';
        speedInput.min = '1';
        speedInput.max = '100';
      } else {
        speedLabel.textContent = 'Pace (min/km)';
        speedInput.value = '10'; // Default walking pace
        speedInput.min = '1';
        speedInput.max = '30';
      }
    });
  });

  // Dummy action for now
  generateBtn.addEventListener('click', () => {
    console.log('Generate route clicked with mode:', 
      (document.querySelector('input[name="mode"]:checked') as HTMLInputElement).value,
      'speed/pace:', speedInput.value
    );
  });
});
