const RAM_SIZE = 0x400000;
const TEXT_START_ADDRESS = 0x08000;
const MAIN_ADDRESS = 0x0800c | 1;
const EXIT_ADDRESS = 0x8014;
const STACK_ADDRESS = 0x200000;
const INPUT_ADDRESS = 0x380000;
const RETURN_ADDRESS = 0x3F0000;

class HeartRateDetector {

	machine = undefined;

	async loadBinary() {
		const req = await fetch('js/prog.bin');
		const arrB = await req.arrayBuffer();
		return new Uint8Array(arrB);
	}

	async setupEmulator() {
		await loadUnicorn();
		
		// Initialize engine
		const e = new uc.Unicorn(uc.ARCH_ARM, uc.MODE_THUMB);

		// Load binary from Internet
		const progBin = await this.loadBinary();

		// Set up memory
		e.mem_map(0, RAM_SIZE, uc.PROT_ALL);
		e.mem_write(TEXT_START_ADDRESS, progBin);

		// Set up float register
		let tmp_val = e.reg_read_i32(uc.ARM_REG_C1_C0_2);
		tmp_val = tmp_val | (0xf << 20);
		e.reg_write_i32(uc.ARM_REG_C1_C0_2, tmp_val);
		e.reg_write_i32(uc.ARM_REG_D16, 0xffff1111);
	    e.reg_write_i32(uc.ARM_REG_FPEXC, 0x40000000);
	    return e;
	}

	analyzeResult(rawResult) {
		const dataView = new DataView(rawResult.buffer, 0);
		const status = dataView.getUint32(0, true);
		const hr = dataView.getUint32(4, true);
		const trust = dataView.getUint32(8, true);
		const noise = dataView.getUint32(12, true);

		let statusString = ''
		if (status === 4) {
			statusString = 'TOO_LOW';
		} else if (status === 48) {
			statusString = 'READY';
		} else if (status === 0) {
			statusString = 'PROCESSING';
		} else {
			statusString = 'Unknown';
		}

		return {
			'status': statusString,
			'value': hr,
			'trustlevel': trust,
			'snr': noise
		}
	}

	async detectHeartRate(rawInput) {
		if (!this.machine) {
			this.machine = await this.setupEmulator();
		}
		this.machine.mem_write(INPUT_ADDRESS, rawInput)
		this.machine.reg_write_i32(uc.ARM_REG_SP, STACK_ADDRESS);
	    this.machine.reg_write_i32(uc.ARM_REG_LR, MAIN_ADDRESS);
		this.machine.emu_start(MAIN_ADDRESS, EXIT_ADDRESS, 0, 0x1FFFFFF);
		const resp = this.machine.mem_read(RETURN_ADDRESS, 16);
		return this.analyzeResult(resp);
	}

}
