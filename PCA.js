var i2cBus = require("i2c-bus");
var Pca9685Driver = require("pca9685").Pca9685Driver;
 

//function normalizer (data, inMin, inMax, outMin, outMax
//
function normal (data, inMin, inMax, outMin, outMax)
{
	return ( ((data - inMin) / (inMax - inMin)) * (outMax - outMin)) + outMin
}

function intraPol (min, max, current)
{
	this.min = min
	this.max = max
	this.current = current

	this.start		= current
	this.goal		= current
	this.startTime	= 0
	this.endTime	= 0

	this.drive = function (time)
	{
		if(time >= this.endTime)
		{
			this.current = this.goal
			return true
		}

		this.current = normal(time, this.startTime, this.endTime, this.start, this.goal )
		return false
	}

	this.move  = function(time, goal, duration)
	{
		this.start = this.current
		this.goal  = goal
		this.startTime = time
		this.endTime = time + duration
	}
}


function motor (pwm, in1, in2)
{
	this.pwmPin = pwm
	this.in1Pin = in1
	this.in2Pin = in2
	this.direction = undefined

	this.drive = function (speed, driver)
	{
		if(speed > 100)  speed = 100
		if(speed < -100) speed = -100

		if(speed >= 0 && this.direction !== true)
		{
			driver.setPulseRange(this.in1Pin, 0, 4095)
			driver.setPulseRange(this.in2Pin, 4095, 0)
			this.direction = true
		}
		if(speed < 0 && this.direction === true)
		{
			driver.setPulseRange(this.in2Pin, 0, 4095)
			driver.setPulseRange(this.in1Pin, 4095, 0)
			this.direction = false
		}

		driver.setPulseRange(this.pwmPin, 0, 40 * Math.abs(speed))
	}
}

function servo (pwm)
{
	this.pwmPin = pwm 

	this.drive = function (speed, driver)
	{
		driver.setPulseLength(this.pwmPin, speed)
	}
}

function servoControl (pwm)
{
	this.motor = new servo(pwm)
	this.poll  = new intraPol(500, 2400, 1500)

	this.update = function (time, driver)
	{
		this.poll.drive(time)
		this.motor.drive(this.poll.current, driver)
	}

	this.setInput = function(angle, duration = 500)
	{
		const pulse = normal(angle, -90, 90, 500, 2400); 
		const time = (new Date).getTime()
		this.poll.move(time, pulse, duration)
	}
}
	

function DCControl (pwm, in1, in2)
{
	this.motor = new motor(pwm, in1, in2)
	this.poll  = new intraPol(-100, 100, 0)

	this.update = function (time, driver)
	{
		this.poll.drive(time)
		this.motor.drive(this.poll.current, driver)
	}

	this.setSpeed = function(speed, duration = 500)
	{
		const time = (new Date).getTime()
		this.poll.move(time, speed, duration)
	}
}

module.exports = function (RED)
{

	function PCAHandle (config)
	{
		const node	 = this;
		RED.nodes.createNode(this, config)
		node.motors	 = [undefined, undefined, undefined, undefined]
		node.servos  = [undefined, undefined, undefined, undefined]
		node.pins	 = new Map()
		node.sPins	 = new Map()

		node.pins.set(1,  [8, 9, 10])
		node.pins.set(2, [13, 12, 11])
		node.pins.set(3, [2, 3, 4])
		node.pins.set(4, [7, 6, 5])

		node.sPins.set(1,0)
		node.sPins.set(0,1) 
		node.sPins.set(14,2) 
		node.sPins.set(15,3)

		node.end	 = false; 
		node.start	 = false;
		
		this.update = function (instant = false)
		{
			if(node.end) return; 

			if(node.start)
			{
				for(const n of node.motors)
				{
					if(!n) continue; 

					const time = (new Date).getTime()
					n.update(time, node.pwm)
				}
				for(const s of node.servos)
				{
					if(!s) continue; 

					const time = (new Date).getTime()
					s.update(time, node.pwm)
				}
			}

			if(instant) return; 
			setTimeout(node.update, 100)
		}

		this.register = function (n)
		{

			if(n < 1) n = 1 
			if(n > 4) n = 4 
			if(node.motors[n - 1]) return

			const pwmPin = node.pins.get(n)[0] 
			const left   = node.pins.get(n)[1]
			const right  = node.pins.get(n)[2] 

			node.motors[n - 1] = new DCControl(pwmPin, left, right); 
		}

		this.registerServo = function (n)
		{
			if(!node.sPins.has(n)) throw('unknown pin!')

			if(node.servos[ node.sPins.get(n)]) return

			node.servos[ node.sPins.get(n)] = new servoControl(n)
		}


		const options = 
		{
			i2c: i2cBus.openSync(1), 
			address: 0x6f, //settable
			frequency: 120, 
			debug: false
		}

		this.pwm = new Pca9685Driver(options, function (err)
		{
			if(err) 
			{
				node.error('Error initing PCA9685')
				node.error(err)
				return
			}
			node.error('inited pca')
			node.start = true
			node.update()

		})

		this.stop = function()
		{
			for(const n of node.motors)
			{
				if(!n) continue; 
				n.setSpeed(0, 0);
			}
		}

		this.on('close', function() 
		{
			this.stop();
			node.end = true
		})
	}

	function DCMotor (config)
	{
		RED.nodes.createNode(this, config)
		const node = this 
		const motorNum = parseInt(config.motor)
		const smooth = parseInt(config.smooth)

		node.handle = RED.nodes.getNode(config.handle)
		node.handle.register(motorNum)


		node.on('input', function (msg)
		{
			const runSpeed  = msg.payload.speed	 === undefined ? parseInt(msg.payload) : parseInt(msg.payload.speed);
			const runSmooth = msg.payload.smooth === undefined ? parseInt(smooth)	   : parseInt(msg.payload.smooth);

			node.handle.motors[motorNum - 1].setSpeed(runSpeed, runSmooth); 
			node.handle.update(true)
		})
	}

	function Servo (config)
	{
		RED.nodes.createNode(this, config)
		const node = this 
		const pinNum = parseInt(config.pin)
		const smooth = parseInt(config.smooth) 

		node.handle = RED.nodes.getNode(config.handle) 
		node.handle.registerServo(pinNum) 

		node.on('input', function (msg)
		{
			const runSpeed  = msg.payload.angle	 === undefined ? parseInt(msg.payload) : parseInt(msg.payload.angle);
			const runSmooth = msg.payload.smooth === undefined ? parseInt(smooth)	   : parseInt(msg.payload.smooth);

			node.handle.servos[node.handle.sPins.get(pinNum)].setInput(runSpeed, runSmooth); 
			node.handle.update(true)
		})
	}


	RED.nodes.registerType('pca-manager', PCAHandle)
	RED.nodes.registerType('pca-DC-motor', DCMotor)
	RED.nodes.registerType('pca-servo', Servo)

}
