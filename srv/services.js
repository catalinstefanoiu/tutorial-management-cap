const cds = require('@sap/cds') // import modulul CDS

cds.env.requires['API_BUSINESS_PARTNER'] = {
  kind: 'odata-v2',
  model: 'srv/external/API_BUSINESS_PARTNER',
  credentials: {
    url: 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER/'
  }
};

class ProcessorService extends cds.ApplicationService {

async init() {
    this.before("UPDATE", "Incidents", (req) => this.onUpdate(req));
    this.before("CREATE", "Incidents", (req) => this.changeUrgencyDueToSubject(req.data));
    this.on('READ', 'Customers', (req) => this.onCustomerRead(req));
    this.on(['CREATE', 'UPDATE'], 'Incidents', (req, next) => this.onCustomerCache(req,next));
    
    this.S4bupa = await cds.connect.to('API_BUSINESS_PARTNER');
    return super.init();
}

    
  async onCustomerCache(req, next) {
    const { Customers } = this.entities;
    const newCustomerId = req.data.customer_ID;
    const result = await next();
    
    // CORECTEAZĂ AICI - folosește this.S4bupa.entities în loc de this.remoteService.entities
    const { A_BusinessPartner } = this.S4bupa.entities;
    
    if (newCustomerId && (req.event == "CREATE" || req.event == "UPDATE")) {
        console.log('>> CREATE or UPDATE customer!');
        
        try {
            const customer = await this.S4bupa.run(SELECT.one(A_BusinessPartner, bp => {
                bp('BusinessPartner', 'BusinessPartnerName', 'FirstName', 'LastName'),
                bp.to_BusinessPartnerAddress(address => {
                    address.to_EmailAddress(emails => {
                        emails('EmailAddress');
                    }),
                    address.to_PhoneNumber(phones => {
                        phones('PhoneNumber');
                    })
                })
            }).where({ BusinessPartner: newCustomerId }));
            
            if(customer) {
                const customerData = {
                    ID: customer.BusinessPartner,
                    email: customer.to_BusinessPartnerAddress?.[0]?.to_EmailAddress?.[0]?.EmailAddress,
                    phone: customer.to_BusinessPartnerAddress?.[0]?.to_PhoneNumber?.[0]?.PhoneNumber
                };
                
                await UPSERT.into(Customers).entries(customerData);
            }
        } catch (error) {
            console.error('Error in onCustomerCache:', error);
        }
    }
    
    return result;
}

    async onCustomerRead(req) {
    console.log('🔥 === onCustomerRead called ===');
    
    try {
        const { A_BusinessPartner } = this.S4bupa.entities;
        console.log('📊 A_BusinessPartner entity:', A_BusinessPartner);
        
        const { $top: top = 50, $skip: skip = 0 } = req.query || {};
        console.log('📋 Query params - top:', top, 'skip:', skip);

        let result = await this.S4bupa.run(SELECT.from(A_BusinessPartner, bp => {
            bp('BusinessPartner', 'BusinessPartnerName', 'FirstName', 'LastName'),
            bp.to_BusinessPartnerAddress(address => {
                address.to_EmailAddress(emails => {
                    emails('EmailAddress');
                });
            })
        }).limit(top, skip));

        console.log('📦 Raw result from S4:', JSON.stringify(result, null, 2));

        result = result.map((bp) => ({
            ID: bp.BusinessPartner,
            name: bp.BusinessPartnerName || `${bp.FirstName} ${bp.LastName}`,
            email: bp.to_BusinessPartnerAddress?.[0]?.to_EmailAddress?.[0]?.EmailAddress
        }));

        console.log('🎯 Mapped result:', JSON.stringify(result, null, 2));
        
        result.$count = result.length;
        return result;
        
    } catch (error) {
        console.error('❌ Error in onCustomerRead:', error);
        
        // Returnează date mock pentru test
        return [
            { ID: '123', name: 'Test Customer 1', email: 'test1@sap.com' },
            { ID: '456', name: 'Test Customer 2', email: 'test2@sap.com' }
        ];
    }
}

    changeUrgencyDueToSubject(data) { // met ce schimba niv de urgenta
        if(data) {
            const incidents = Array.isArray(data) ? data : [data]; // se asig ca lucram mereu cu array

            incidents.forEach((incident) => {
                if(incident.title?.toLowerCase().includes("urgent")) {
                    incident.urgency = { code: "H", descr: "High"};
                }
            });
        }
    }

    async onUpdate (req) { // validare pers pt update
        //citeste status code pentru incidentul care se modifica(bazat pe id)
        const { status_code } = await SELECT
        .one(req.subject, i => i.status_code)
        .where({ID: req.data.ID})

    if (status_code === 'C') {
        return req.reject(`Can't modify a closed incident`)
    }
    }
}

module.exports = { ProcessorService } //exporta clasa ca modul pt a putea fi fol