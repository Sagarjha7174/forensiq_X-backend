const {PrismaClient}=require("@prisma/client");

const prisma=new PrismaClient();

const updateCourse=async(req,res)=>{
    const courseId=req.params.id;
    const course=await prisma.course.findUnique({
        where:{
            id:courseId
        }
    });
    if(!course){
        return res.status(404).json({error:"Course not found"});
    }
    const { name, description, courseClass, teacher, degree, videoUrl, imageUrl, price, status } = req.body;
    try {
        var updatedCourse = await prisma.course.update({
            where:{
                id:courseId
            },
            data: {
                name:name || course.name,
                description:description || course.description,
                class:courseClass || course.class,
                teacher:teacher || course.teacher,
                degree:degree || course.degree,
                videoUrl:videoUrl || course.videoUrl,
                imageUrl:imageUrl || course.imageUrl,
                price:price !== undefined ? price : course.price,
                status: status || course.status
            },
        });
        res.status(201).json(updatedCourse);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

module.exports={updateCourse};