var i2cBus = require("i2c-bus");
var Pca9685Driver = require("pca9685").Pca9685Driver;
 
var options = {
    i2c: i2cBus.openSync(1),
    address: 0x6f,
    frequency: 1600,
    debug:true 
};
pwm = new Pca9685Driver(options, function(err) {
    if (err) {
        console.error("Error initializing PCA9685");
		console.error(err);
        process.exit(-1);
    }
    console.log("Initialization done");

	PWMpin =13
	IN2pin =12 
	IN1pin =11 

    pwm.setPulseRange(IN1pin, 0, 4095)
    pwm.setPulseRange(IN2pin, 4095, 0)
	pwm.setPulseRange(PWMpin, 0, 1095)


	
});
 
setTimeout(function() {

	pwm.setPulseRange(PWMpin, 0, 100 * 0)
}, 1000);

