import ky from 'ky'
import { options, getBaseURL } from "./apiConfig"
import { getCatchmentGeoJSON, updateCatchmentItem, getCatchmentJob } from "./crosscutRequests"
import i18n from "../locales/index"

const baseURL = getBaseURL()

export const fetchOrgUnitLevels = async () => {
    const orgUnits = await ky.get(`${baseURL}/organisationUnits.json?fields=id,displayName~rename(name)&paging=false`, options).json()

    const resp = await ky.get(`${baseURL}/organisationUnitLevels.json?fields=id,displayName~rename(name),level&paging=false&order=level:asc`, options).json()
    return resp.organisationUnitLevels
}

export const fetchOrgUnitGroups = async () => {
    const resp = await ky.get(`${baseURL}/organisationUnitGroups.json?fields=id,displayName~rename(name)&paging=false`, options).json()
    return resp.organisationUnitGroups
}

export const fetchACatchmentInUse = async (id) => {
    // id is the attribute id
    const resp = await ky.get(`${baseURL}/maps.json?filter=mapViews.orgUnitField:eq:${id}`, options).json()
    return resp.maps
}

export const fetchCurrentAttributes = async () => {
    const resp = await ky.get(`${baseURL}/attributes.json?fields=id,name&filter=valueType:eq:GEOJSON&filter=organisationUnitAttribute:eq:true&paging=false`, options).json()
    return resp.attributes
}

export const fetchValidPoints = async (levelId, groupId) => {
    let groupLink = []
    if (groupId.length > 1) {   
        groupId.forEach((id) => groupLink.push(`%3BOU_GROUP-${id}`))
    } else {
        groupLink = groupId
    }

    let resp = await ky(`${baseURL}/geoFeatures?ou=ou%3ALEVEL-${levelId}%3BOU_GROUP-${groupLink}&displayProperty=NAME`, options).json()

    resp = resp.filter((feature) => feature.ty === 1)

    const features = resp.map((feature) => {
        const coord = JSON.parse(feature.co)
        const lat = coord[1]
        const long = coord[0]
        return {
            id: feature.id,
            lat,
            long,
            id: feature.id,
            name: feature.na,
            level: feature.le,
            parentName: feature.pn,
            parentId: feature.pi,
            code: feature.code
        }
    })
    return features
}

export const publishCatchment = async (body) => {
    try {
        const features = await getCatchmentGeoJSON(body.id)
        console.log(features)
    
        // orgUnit ids do not match the orgUnit ids from creation
        const orgUnits = await ky.get(`${baseURL}/organisationUnits.json?fields=id,displayName~rename(name)&paging=false`, options).json()
        console.log(orgUnits)
    
        // this endpoint posts an attribute and returns uid
        const resp = await ky.post(`${baseURL}/attributes`, { body: JSON.stringify(body.payload), headers: options }).json()
        console.log(resp)
        // use this id to store with the catchment areas
        const attributeId = resp?.response?.uid
    
        options["Content-Type"] = "application/json-patch+json"

        for (let i=0; i<orgUnits.organisationUnits.length; i++) {
            const id = orgUnits.organisationUnits[i].id
            const exists = features.find((feat) => feat.properties["user:orgUnitId"] === id)
            console.log(exists)
            if (exists !== undefined) {
                const geojson = JSON.stringify(exists.geometry)
                const orgId = orgUnits.organisationUnits[i].id
                // handle adding geojson to each org unit
                await ky.patch(`${baseURL}/organisationUnits/${orgId}`, {
                        headers: options,
                        body: JSON.stringify([{
                          op: "add",
                          path: "/attributeValues/-",
                          value: {
                            value: geojson,
                            attribute: {
                              id: attributeId,
                            },
                          },
                        }]),
                      })
                      .json();
            }
        }
        body.setStatus(i18n.t("Unpublish"))

        // add attribute id to catchment areas on Crosscut
        const attributeResp = await updateCatchmentItem(body.id, { field: "attributeId", value: attributeId })
        console.log(attributeResp)
    } catch (err) {
        body.setStatus(i18n.t("Publish"))
        throw err
    }
}

export const unPublishCatchment = async (body) => {
    try {
        // remove attributes from each org unit and attribute
        const features = await getCatchmentGeoJSON(body.id)

        const orgUnits = await ky.get(`${baseURL}/organisationUnits.json?fields=id,displayName~rename(name)&paging=false`, options).json()

        for (let i=0; i<features.length; i++) {
            const orgId = features[i].properties["user:orgUnitId"]
    
            const exists = orgUnits.organisationUnits.find((unit) => unit.id === orgId)
            console.log(exists)
            if (exists !== undefined) {
                console.log("hit")
                // this gets all the attribute values for a given organization unit
                const resp = await ky(`${baseURL}/organisationUnits/${orgId}?fields=%3Aall%2CattributeValues%5B%3Aall%2Cattribute%5Bid%2Cname%2CdisplayName%5D%5D`, options).json()
                console.log(resp)
                const filtered = resp.attributeValues.filter((value) => value.attribute.id !== body.attributeId)
                console.log(filtered)

                const payload = {
                    attributeValues: filtered,
                    code: resp.code,
                    created: resp.created,
                    createdBy: resp.createdBy,
                    id: resp.id,
                    lastUpdated:  resp.lastUpdated,
                    lastUpdatedBy: resp.lastUpdatedBy,
                    level: resp.level,
                    name: resp.name,
                    openingDate: resp.openingDate,
                    parent: resp.parent,
                    path: resp.path,
                    shortName: resp.shortName,
                }

                // delete coordinates from each org unit
                await ky.put(`${baseURL}/organisationUnits/${orgId}?mergeMode=REPLACE`, {
                    headers: options,
                    body: JSON.stringify(payload),
                    }).json();
            }
        }
        // delete attribute
        await ky.delete(`${baseURL}/attributes/${body.attributeId}`, options).json()

        body.setStatus(i18n.t("Publish"))

        // remove the attribute id from the catchment ares on Crosscut
        const attributeResp = await updateCatchmentItem(body.id, { field: "attributeId" })
        console.log(attributeResp)
    } catch (err) {
        body.setStatus(i18n.t("Unpublish"))
        throw err
    }
  
}