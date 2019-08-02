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
		console.log(this.current)
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


function motor (driver, pwm, in1, in2)
{
	this.driver = driver
	this.pwmPin = pwm
	this.in1Pin = in1
	this.in2Pin = in2
	this.direction = undefined

	this.drive = function (speed)
	{
		if(speed > 100)  speed = 100;
		if(speed < -100) speed = -100;

		if(speed >= 0 && !this.direction)
		{
			this.driver.setPulseRange(this.in1Pin, 0, 4095)
			this.driver.setPulseRange(this.in2Pin, 4095, 0)
			this.direction = true
		}
		if(speed < 0 && this.direction)
		{
			this.driver.setPulseRange(this.in2Pin, 0, 4095)
			this.driver.setPulseRange(this.in1Pin, 4095, 0)
			this.direction = false
		}

		this.driver.setPulseRange(this.pwmPin, 0, 40 * Math.abs(speed))
	}
}

function DCControl (driver, pwm, in1, in2)
{
	this.motor = new motor(driver, pwm, in1, in2)
	this.poll  = new intraPol(-100, 100, 0)

	this.update = function (time)
	{
		this.poll.drive(time)
		this.motor.drive(this.poll.current)
	}

	this.setSpeed = function(speed)
	{
		const time = (new Date).getTime()
		this.poll.move(time, speed, 2)
	}
}


var options = {
    i2c: i2cBus.openSync(1),
    address: 0x6f,
    frequency: 1600,
    debug:false 
};
var pwm = new Pca9685Driver(options, function(err) {
    if (err) {
        console.error("Error initializing PCA9685");
		console.error(err);
        process.exit(-1);
    }
const time = (new Date).getTime()
var test = new intraPol(-100, 100, 0)
var wheel = new motor(pwm, 13, 12, 11)
test.move(time,100 , 10000)
//wheel.drive(50)
var direction = true

function speed ()
	{
		const time = (new Date).getTime()
		wheel.drive(test.current)
		if(test.drive(time))
		{
			var val = direction ? -100 : 100
			direction = !direction
			test.move(time, val, 10000)
			return speed()
		}
			setTimeout(speed, 10)
	}

	speed()

});
 


function PCADad (config)
{
	this.pollRegister
	this.end = false; 

	this.update = function ()
	{
		if(this.end) return; 

		for(const n of this.pollRegister)
		{
			const time = (new Date).getTime()
			n.update(time)
		}
		//setTimeout(this.update, 300)

	}

	this.register = function (p)
	{
		this.pollRegister.add(p)
	}

	this.unRegister = function (p)
	{
		this.pollRegister.remove(p)
	}
}

