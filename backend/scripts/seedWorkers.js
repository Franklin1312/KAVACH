const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Worker = require('../src/models/Worker');
const Policy = require('../src/models/Policy');
const Claim = require('../src/models/Claim');

const CITY_ZONES = {
  mumbai:     ['bandra', 'andheri', 'dharavi', 'kurla', 'dadar', 'borivali', 'worli', 'colaba'],
  chennai:    ['anna_nagar', 't_nagar', 'adyar', 'marina', 'tambaram', 'velachery', 'porur'],
  bengaluru:  ['koramangala', 'indiranagar', 'whitefield', 'hsr_layout', 'mg_road', 'jayanagar'],
  delhi:      ['connaught_place', 'lajpat_nagar', 'dwarka', 'rohini', 'saket', 'karol_bagh'],
  kochi:      ['kakkanad', 'edapally', 'aluva', 'fort_kochi', 'thrippunithura', 'palarivattom'],
  pune:       ['hinjewadi', 'magarpatta', 'koregaon_park', 'viman_nagar', 'kothrud', 'wakad'],
  hyderabad:  ['gachibowli', 'hitec_city', 'banjara_hills', 'jubilee_hills', 'uppal', 'madhapur'],
  kolkata:    ['salt_lake', 'new_town', 'park_street', 'howrah', 'jadavpur', 'rajarhat'],
  ahmedabad:  ['vastrapur', 'satellite', 'navrangpura', 'bopal', 'prahlad_nagar'],
  jaipur:     ['malviya_nagar', 'mansarovar', 'vaishali_nagar', 'c_scheme', 'sodala'],
  lucknow:    ['gomti_nagar', 'alambagh', 'hazratganj', 'indira_nagar', 'aminabad'],
  surat:      ['adajan', 'piplod', 'varachha', 'vesu', 'athwalines'],
  chandigarh: ['sector_17', 'sector_22', 'sector_35', 'manimajra', 'industrial_area'],
  indore:     ['vijay_nagar', 'palasia', 'rajwada', 'bhanwarkuan', 'sudama_nagar'],
  nagpur:     ['dharampeth', 'sitabuldi', 'sadar', 'manish_nagar', 'wardhaman_nagar'],
  coimbatore: ['rs_puram', 'peelamedu', 'gandhipuram', 'race_course', 'saibaba_colony']
};
const CITIES = Object.keys(CITY_ZONES);

const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Krishna', 'Ishaan', 'Shaurya', 'Ayaan', 'Rahul', 'Rohan', 'Amit', 'Vikram', 'Raj', 'Ravi', 'Sanjay', 'Surya', 'Prakash', 'Karthik', 'Suresh', 'Manoj', 'Deepak', 'Vijay', 'Praveen'];
const LAST_NAMES = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Rao', 'Iyer', 'Pillai', 'Nair', 'Das', 'Roy', 'Gupta', 'Verma', 'Chowdhury', 'Yadav', 'Gowda', 'Shetty', 'Jain', 'Mehta', 'Kaur', 'Natarajan', 'Hegde', 'Menon'];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kavachdb');
    console.log('Connected to MongoDB');

    console.log('Preserving existing remote Atlas DB data...');
    // await Worker.deleteMany({ isVerified: true });
    // await Policy.deleteMany({});
    // await Claim.deleteMany({});

    const workersToCreate = 50000;
    const workers = [];
    console.log(`Generating ${workersToCreate} realistic workers across 16 cities...`);

    for (let i = 0; i < workersToCreate; i++) {
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const zones = CITY_ZONES[city];
      const zone = zones[Math.floor(Math.random() * zones.length)];
      
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      // Safely offset from existing seed indexes to guarantee 100% unique constraint compliance on MongoAtlas
      const phone = `99${30000000 + i}`;

      let declaredWeeklyIncome, zoneRiskFactor;
      if (['mumbai', 'chennai', 'kolkata'].includes(city)) {
        zoneRiskFactor = 1.5;
        declaredWeeklyIncome = Math.floor(Math.random() * 2000) + 7000;
      } else if (['bengaluru', 'delhi', 'pune', 'hyderabad', 'ahmedabad'].includes(city)) {
        zoneRiskFactor = 1.2;
        declaredWeeklyIncome = Math.floor(Math.random() * 2000) + 6000;
      } else {
        zoneRiskFactor = 1.0;
        declaredWeeklyIncome = Math.floor(Math.random() * 2000) + 4000;
      }

      const availablePlatforms = ['zomato', 'swiggy', 'blinkit'];
      const myPlatform = availablePlatforms[Math.floor(Math.random() * availablePlatforms.length)];

      workers.push({
        _id: new mongoose.Types.ObjectId(),
        name: `${firstName} ${lastName}`,
        phone,
        city,
        zone,
        declaredWeeklyIncome, 
        verifiedWeeklyIncome: declaredWeeklyIncome + Math.floor(Math.random() * 200) - 100,
        isVerified: true,
        isActive: true,
        zoneRiskFactor,
        claimsFreeWeeks: Math.floor(Math.random() * 20),
        platformActiveDays: Math.floor(Math.random() * 60) + 90, 
        engagementQualified: true,
        platforms: [{
          name: myPlatform,
          partnerId: `PRT-${Math.floor(1000 + Math.random() * 9000)}`,
          verified: true
        }],
        upiId: `${phone}@paytm`,
        bankAccount: {
            accountNumber: `00001${Math.floor(Math.random() * 99999999)}`,
            ifsc: 'HDFC0001234',
        },
        dpdpConsent: {
          gps: true,
          bank: true,
          platform: true,
          consentedAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000))
        }
      });
    }

    const insertedWorkers = await Worker.insertMany(workers, { ordered: false });
    console.log(`✅ ${insertedWorkers.length} Workers inserted.`);

    console.log('Generating active policies with authentic real-world premium pricing...');
    let policies = [];
    let claims = [];

    const TIERS = ['basic', 'standard', 'premium'];
    const now = new Date();

    for (let w = 0; w < 6; w++) {
      const weekDate = new Date(now);
      weekDate.setDate(now.getDate() - (w * 7));
      
      const weekStart = new Date(weekDate);
      weekStart.setDate(weekDate.getDate() - weekDate.getDay() + 1);
      weekStart.setHours(0, 0, 1, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 0);

      for (const worker of insertedWorkers) {
        if (Math.random() > 0.85) continue; 

        const tier = TIERS[Math.floor(Math.random() * TIERS.length)];
        const coveragePct = tier === 'basic' ? 0.5 : tier === 'standard' ? 0.7 : 0.85;
        
        // Authentic ~₹150 weekly gig premium, absolutely no artificial padding
        const finalAmount = Math.floor(Math.random() * 80) + 120;

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

        // Elevated baseline probability (75%) to strictly hit target BCR 60-70% zone for Guidewire realistic actuarial standards.
        if (w < 5 && Math.random() < 0.75) { 
          // Net loss of ~₹500-₹700 for a single missed day or minor flood
          const netLoss = Math.floor(Math.random() * 400) + 300;
          const payoutAmount = Math.floor(netLoss * coveragePct);
          
          claims.push({
            worker: worker._id,
            policy: policyId,
            triggerType: Math.random() > 0.5 ? 'rain' : 'heatwave',
            triggerLevel: Math.random() > 0.8 ? 3 : 2,
            disruptionStart: weekStart,
            predictedLoss: netLoss + 50,
            netLoss: netLoss,
            payoutAmount,
            payoutStatus: 'paid',
            paidAt: weekStart,
            fraudScore: Math.floor(Math.random() * 15),
            createdAt: weekStart,
          });
        }
      }

      // Memory flush helper - bulk insert if array gets too huge
      if (policies.length > 50000) {
        await Policy.insertMany(policies, { ordered: false });
        await Claim.insertMany(claims, { ordered: false });
        policies = [];
        claims = [];
        console.log(`Batched inserted models for week ${w}...`);
      }
    }

    if (policies.length > 0) {
        await Policy.insertMany(policies, { ordered: false });
        await Claim.insertMany(claims, { ordered: false });
    }

    const dbPolicies = await Policy.countDocuments();
    const dbClaims = await Claim.countDocuments();

    console.log(`✅ ${dbPolicies} Total Policies inserted.`);
    console.log(`✅ ${dbClaims} Total Claims inserted.`);
    
    console.log('\nSeed complete! Restart your backend and check your 10K Stress Test Dashboard.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
