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
	this.current = current; 

	this.start		= undefined
	this.goal		= undefined
	this.startTime	= undefined
	this.endTime	= undefined

	this.drive = function (time)
	{
		if(time >= this.endTime)
		{
			this.current = this.goal
			return true;
		}

		this.current = normal(time, this.startTime, this.endTime, this.start, this.goal )
		return false
	}

	this.move  = function(time, goal, duration)
	{
		this.start = this.current
		this.goal  = goal;
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
		if(speed > 100)  speed = 100;
		if(speed < -100) speed = -100;

		if(speed >= 0 && !this.direction)
		{
			driver.setPulseRange(this.in1Pin, 0, 4095)
			driver.setPulseRange(this.in2Pin, 4095, 0)
			this.direction = true
		}
		if(speed < 0 && this.direction)
		{
			driver.setPulseRange(this.in2Pin, 0, 4095)
			driver.setPulseRange(this.in1Pin, 4095, 0)
			this.direction = false
		}

		driver.setPulseRange(this.pwmPin, 0, 40 * Math.abs(speed))
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

	this.setSpeed = function(speed)
	{
		const time = (new Date).getTime()
		this.poll.move(time, speed, 500)
	}
}

function PCADad (config)
{
	const node = this;
	node.pollRegister = new Set();
	node.end = false; 
	node.start = false;
	
	this.update = function ()
	{
		if(node.end) return; 

		if(node.start)
		{
			for(const n of node.pollRegister)
			{
				const time = (new Date).getTime()
				n.update(time, node.pwm)
			}
		}

		setTimeout(node.update, 300)

	}

	this.register = function (p)
	{
		node.pollRegister.add(p)
	}

	this.unRegister = function (p)
	{
		node.pollRegister.remove(p)
	}

	const options = 
	{
		i2c: i2cBus.openSync(1), 
		address: 0x6f, //settable
		frequency: 1600, 
		debug: false
	};

	this.pwm = new Pca9685Driver(options, function (err)
	{
		if(err) 
		{
			console.error("Error initing PCA9685")
			console.error(err)
			return;
		}
		console.error("inited pca")
		node.start = true;
	});

	this.update();
}

var comp = new PCADad ();
var dc   = new DCControl(13, 12, 11);
comp.register(dc); 
dc.setSpeed(100);
setTimeout(function()
	{
		dc.setSpeed(0);
	}, 10000);

