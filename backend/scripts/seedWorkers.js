const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const Worker = require('../src/models/Worker');
const Policy = require('../src/models/Policy');
const Claim = require('../src/models/Claim');

const CITY_ZONES = {
  mumbai:     ['bandra', 'andheri', 'dharavi', 'kurla', 'dadar', 'borivali', 'worli', 'colaba', 'powai', 'vikhroli'],
  chennai:    ['anna_nagar', 't_nagar', 'adyar', 'marina', 'tambaram', 'velachery', 'sholinganallur', 'porur', 'ambattur', 'perungudi'],
  bengaluru:  ['koramangala', 'indiranagar', 'whitefield', 'hsr_layout', 'electronic_city', 'mg_road', 'jayanagar', 'marathahalli', 'hebbal', 'yelahanka'],
  delhi:      ['connaught_place', 'lajpat_nagar', 'dwarka', 'rohini', 'saket', 'noida_sec_62', 'karol_bagh', 'janakpuri', 'pitampura', 'vasant_kunj'],
  kochi:      ['kakkanad', 'edapally', 'aluva', 'fort_kochi', 'thrippunithura', 'kalamassery', 'perumbavoor', 'angamaly', 'vyttila', 'palarivattom'],
  pune:       ['hinjewadi', 'magarpatta', 'koregaon_park', 'viman_nagar', 'kothrud', 'wakad', 'baner', 'hadapsar', 'pimpri', 'chinchwad'],
  hyderabad:  ['gachibowli', 'hitec_city', 'banjara_hills', 'jubilee_hills', 'uppal', 'secunderabad', 'kukatpally', 'madhapur', 'ameerpet', 'lb_nagar'],
  kolkata:    ['salt_lake', 'new_town', 'park_street', 'howrah', 'dum_dum', 'behala', 'jadavpur', 'garia', 'rajarhat', 'ballygunge'],
};

const CITIES = Object.keys(CITY_ZONES);

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kavachdb');
    console.log('Connected to MongoDB');

    // Wipe previous seeded data (keep admins or real users if possible, but let's just clear for clean test)
    console.log('Clearing old seeded data...');
    await Worker.deleteMany({ name: { $regex: /^Test Worker / } });
    await Policy.deleteMany({ 'premium.finalAmount': { $exists: true } });
    await Claim.deleteMany({ 'fraudScore': { $exists: true } });

    const workersToCreate = 1000;
    const workers = [];
    console.log(`Generating ${workersToCreate} workers...`);

    for (let i = 0; i < workersToCreate; i++) {
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const zones = CITY_ZONES[city];
      const zone = zones[Math.floor(Math.random() * zones.length)];
      
      workers.push({
        name: `Test Worker ${i}`,
        phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
        city,
        zone,
        declaredWeeklyIncome: Math.floor(Math.random() * 5000) + 3000, // 3000-8000
        verifiedWeeklyIncome: null,
        isVerified: true,
        isActive: true,
        zoneRiskFactor: city === 'mumbai' || city === 'chennai' ? 1.5 : 1.0,
        claimsFreeWeeks: Math.floor(Math.random() * 10),
      });
    }

    const insertedWorkers = await Worker.insertMany(workers);
    console.log(`✅ ${insertedWorkers.length} Workers inserted.`);

    console.log('Generating Policies & Claims over the last 4 weeks...');
    const policies = [];
    const claims = [];

    const TIERS = ['basic', 'standard', 'premium'];
    const now = new Date();

    // Spread data across last 4 weeks
    for (let w = 0; w < 4; w++) {
      const weekDate = new Date(now);
      weekDate.setDate(now.getDate() - (w * 7));
      
      const weekStart = new Date(weekDate);
      weekStart.setDate(weekDate.getDate() - weekDate.getDay() + 1);
      weekStart.setHours(0, 0, 1, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 0);

      for (const worker of insertedWorkers) {
        // Not everyone buys a policy every week (80% retention)
        if (Math.random() > 0.8) continue;

        const tier = TIERS[Math.floor(Math.random() * TIERS.length)];
        const coveragePct = tier === 'basic' ? 0.5 : tier === 'standard' ? 0.7 : 0.85;
        const finalAmount = Math.floor(Math.random() * 100) + 120; // Premium ₹120-₹220

        const policyId = new mongoose.Types.ObjectId();
        policies.push({
          _id: policyId,
          worker: worker._id,
          tier,
          coveragePct,
          premium: {
            baseRate: 100,
            zoneRiskFactor: worker.zoneRiskFactor,
            seasonMultiplier: 1.0,
            claimsFreeDiscount: 10,
            surgeLoading: 0,
            tierMultiplier: 1.0,
            finalAmount,
          },
          weekStart,
          weekEnd,
          maxPayout: finalAmount * 15,
          status: w === 0 ? 'active' : 'expired',
          premiumPaid: true,
          createdAt: weekStart,
        });

        // 15% probability of a claim during that week
        if (Math.random() < 0.15) {
          const payoutAmount = Math.floor(Math.random() * 400) + 300; // Payout ₹300-₹700
          
          claims.push({
            worker: worker._id,
            policy: policyId,
            triggerType: 'rain',
            triggerLevel: 2,
            disruptionStart: weekStart,
            predictedLoss: payoutAmount + 100,
            netLoss: payoutAmount + 100,
            payoutAmount,
            payoutStatus: 'paid',
            paidAt: weekStart, // Paid same week
            fraudScore: Math.floor(Math.random() * 20),
            createdAt: weekStart,
          });
        }
      }
    }

    const insertedPolicies = await Policy.insertMany(policies);
    const insertedClaims = await Claim.insertMany(claims);

    console.log(`✅ ${insertedPolicies.length} Policies inserted.`);
    console.log(`✅ ${insertedClaims.length} Claims inserted.`);
    
    // Quick Math Printout
    const totalPremium = policies.reduce((acc, p) => acc + p.premium.finalAmount, 0);
    const totalPayouts = claims.reduce((acc, c) => acc + c.payoutAmount, 0);
    console.log(`\n📊 4-Week Snapshot`);
    console.log(`Premiums Collected : ₹${totalPremium.toLocaleString()}`);
    console.log(`Payouts Disbursed  : ₹${totalPayouts.toLocaleString()}`);
    console.log(`P2P Ratio          : ${((totalPayouts / totalPremium) * 100).toFixed(1)}%`);

    console.log('\nSeed complete! Check your Admin Sustainability Dashboard.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
